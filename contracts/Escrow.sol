// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Escrow is Ownable2Step, ReentrancyGuard {
    enum ProjectStatus {
        Active,
        Completed
    }

    enum MilestoneStatus {
        Funded,
        Submitted,
        Disputed,
        Paid,
        Refunded,
        RevisionRequested,
        Split
    }

    struct Project {
        address payable client;
        address payable freelancer;
        uint256 totalBudget;
        uint256 remainingBalance;
        uint256 milestoneCount;
        ProjectStatus status;
    }

    struct Milestone {
        string description;
        string submissionURI;
        uint256 amount;
        uint256 deadline;
        uint256 submittedAt;
        uint256 disputedAt;
        uint8 revisionCount;
        MilestoneStatus status;
    }

    uint256 public constant MAX_MILESTONES = 20;
    uint256 public constant MAX_REVISIONS = 3;
    uint256 public constant REVIEW_PERIOD = 7 days;
    uint256 public constant REVISION_PERIOD = 7 days;
    uint256 public constant ARBITRATION_TIMEOUT = 30 days;

    uint256 public nextProjectId = 1;

    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(address => uint256) public pendingWithdrawals;

    event ProjectCreated(
        uint256 indexed projectId,
        address indexed client,
        address indexed freelancer,
        uint256 totalBudget
    );

    event MilestoneCreated(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        uint256 amount,
        uint256 deadline,
        string description
    );

    event WorkSubmitted(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        string submissionURI
    );

    event RevisionRequested(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        uint256 newDeadline,
        string reason
    );

    event DisputeRaised(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address indexed raisedBy
    );

    event MilestonePaid(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address freelancer,
        uint256 amount
    );

    event MilestoneRefunded(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address client,
        uint256 amount
    );

    event DisputeResolved(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        uint256 freelancerAmount,
        uint256 clientAmount
    );

    event ProjectCompleted(uint256 indexed projectId);

    event Withdrawn(address indexed account, uint256 amount);

    modifier validProject(uint256 projectId) {
        require(
            projects[projectId].client != address(0),
            "Project does not exist"
        );
        _;
    }

    modifier validMilestone(uint256 projectId, uint256 milestoneId) {
        require(
            milestoneId < projects[projectId].milestoneCount,
            "Invalid milestone"
        );
        _;
    }

    modifier onlyClient(uint256 projectId) {
        require(
            msg.sender == projects[projectId].client,
            "Not project client"
        );
        _;
    }

    modifier onlyFreelancer(uint256 projectId) {
        require(
            msg.sender == projects[projectId].freelancer,
            "Not project freelancer"
        );
        _;
    }

    modifier onlyActive(uint256 projectId) {
        require(
            projects[projectId].status == ProjectStatus.Active,
            "Project not active"
        );
        _;
    }

    constructor(address initialArbitrator) Ownable(initialArbitrator) {}

    function arbitrator() external view returns (address) {
        return owner();
    }

    function renounceOwnership() public pure override {
        revert("Renounce disabled");
    }

    function createProject(
        address payable freelancer,
        string[] calldata descriptions,
        uint256[] calldata amounts,
        uint256[] calldata deadlines
    ) external payable returns (uint256 projectId) {
        require(freelancer != address(0), "Invalid freelancer");
        require(freelancer != msg.sender, "Cannot hire yourself");
        require(
            owner() != msg.sender && owner() != freelancer,
            "Arbitrator cannot be a party"
        );

        uint256 total = _validateMilestones(descriptions, amounts, deadlines);
        require(msg.value == total, "Incorrect funding amount");

        projectId = nextProjectId++;

        projects[projectId] = Project({
            client: payable(msg.sender),
            freelancer: freelancer,
            totalBudget: total,
            remainingBalance: total,
            milestoneCount: amounts.length,
            status: ProjectStatus.Active
        });

        _storeMilestones(projectId, descriptions, amounts, deadlines);

        emit ProjectCreated(projectId, msg.sender, freelancer, total);
    }

    function submitWork(
        uint256 projectId,
        uint256 milestoneId,
        string calldata submissionURI
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyFreelancer(projectId)
        onlyActive(projectId)
    {
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            milestone.status == MilestoneStatus.Funded ||
                milestone.status == MilestoneStatus.RevisionRequested,
            "Milestone not awaiting work"
        );
        require(block.timestamp <= milestone.deadline, "Deadline passed");
        require(bytes(submissionURI).length > 0, "Empty submission URI");

        milestone.submissionURI = submissionURI;
        milestone.submittedAt = block.timestamp;
        milestone.status = MilestoneStatus.Submitted;

        emit WorkSubmitted(projectId, milestoneId, submissionURI);
    }

    function approveMilestone(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyClient(projectId)
        onlyActive(projectId)
    {
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            milestone.status == MilestoneStatus.Submitted,
            "Work not submitted"
        );

        _settle(
            projectId,
            milestoneId,
            milestone.amount,
            0,
            MilestoneStatus.Paid
        );
    }

    function requestRevision(
        uint256 projectId,
        uint256 milestoneId,
        string calldata reason
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyClient(projectId)
        onlyActive(projectId)
    {
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            milestone.status == MilestoneStatus.Submitted,
            "Work not submitted"
        );
        require(
            block.timestamp <= milestone.submittedAt + REVIEW_PERIOD,
            "Review period over"
        );
        require(milestone.revisionCount < MAX_REVISIONS, "Revision limit reached");
        require(bytes(reason).length > 0, "Empty reason");

        milestone.revisionCount += 1;
        milestone.deadline = block.timestamp + REVISION_PERIOD;
        milestone.status = MilestoneStatus.RevisionRequested;

        emit RevisionRequested(
            projectId,
            milestoneId,
            milestone.deadline,
            reason
        );
    }

    function refundUnsubmitted(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyClient(projectId)
        onlyActive(projectId)
    {
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            milestone.status == MilestoneStatus.Funded ||
                milestone.status == MilestoneStatus.RevisionRequested,
            "Milestone not awaiting work"
        );
        require(block.timestamp > milestone.deadline, "Deadline not passed");

        _settle(
            projectId,
            milestoneId,
            0,
            milestone.amount,
            MilestoneStatus.Refunded
        );
    }

    function claimAfterReviewTimeout(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyFreelancer(projectId)
        onlyActive(projectId)
    {
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            milestone.status == MilestoneStatus.Submitted,
            "Work not submitted"
        );
        require(
            block.timestamp > milestone.submittedAt + REVIEW_PERIOD,
            "Review period not over"
        );

        _settle(
            projectId,
            milestoneId,
            milestone.amount,
            0,
            MilestoneStatus.Paid
        );
    }

    function raiseDispute(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyActive(projectId)
    {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            msg.sender == project.client || msg.sender == project.freelancer,
            "Not a project party"
        );
        require(
            milestone.status == MilestoneStatus.Submitted,
            "Milestone not submitted"
        );
        require(
            block.timestamp <= milestone.submittedAt + REVIEW_PERIOD,
            "Review period over"
        );

        milestone.status = MilestoneStatus.Disputed;
        milestone.disputedAt = block.timestamp;

        emit DisputeRaised(projectId, milestoneId, msg.sender);
    }

    function resolveDispute(
        uint256 projectId,
        uint256 milestoneId,
        uint256 freelancerAmount
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyOwner
        onlyActive(projectId)
    {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            msg.sender != project.client && msg.sender != project.freelancer,
            "Arbitrator is a party"
        );
        require(
            milestone.status == MilestoneStatus.Disputed,
            "Milestone not disputed"
        );
        require(freelancerAmount <= milestone.amount, "Amount exceeds milestone");

        uint256 clientAmount = milestone.amount - freelancerAmount;

        MilestoneStatus finalStatus = freelancerAmount == milestone.amount
            ? MilestoneStatus.Paid
            : freelancerAmount == 0
                ? MilestoneStatus.Refunded
                : MilestoneStatus.Split;

        _settle(
            projectId,
            milestoneId,
            freelancerAmount,
            clientAmount,
            finalStatus
        );

        emit DisputeResolved(
            projectId,
            milestoneId,
            freelancerAmount,
            clientAmount
        );
    }

    function resolveExpiredDispute(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        onlyActive(projectId)
    {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];

        require(
            msg.sender == project.client || msg.sender == project.freelancer,
            "Not a project party"
        );
        require(
            milestone.status == MilestoneStatus.Disputed,
            "Milestone not disputed"
        );
        require(
            block.timestamp > milestone.disputedAt + ARBITRATION_TIMEOUT,
            "Arbitration still pending"
        );

        uint256 freelancerAmount = milestone.amount / 2;
        uint256 clientAmount = milestone.amount - freelancerAmount;

        _settle(
            projectId,
            milestoneId,
            freelancerAmount,
            clientAmount,
            MilestoneStatus.Split
        );

        emit DisputeResolved(
            projectId,
            milestoneId,
            freelancerAmount,
            clientAmount
        );
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawn(msg.sender, amount);
    }

    function getMilestone(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        view
        validProject(projectId)
        validMilestone(projectId, milestoneId)
        returns (Milestone memory)
    {
        return milestones[projectId][milestoneId];
    }

    function _validateMilestones(
        string[] calldata descriptions,
        uint256[] calldata amounts,
        uint256[] calldata deadlines
    ) internal view returns (uint256 total) {
        require(descriptions.length > 0, "No milestones");
        require(descriptions.length == amounts.length, "Length mismatch");
        require(descriptions.length == deadlines.length, "Length mismatch");
        require(descriptions.length <= MAX_MILESTONES, "Too many milestones");

        for (uint256 i = 0; i < amounts.length; i++) {
            require(bytes(descriptions[i]).length > 0, "Empty description");
            require(amounts[i] > 0, "Amount must be positive");
            require(deadlines[i] > block.timestamp, "Deadline in the past");
            total += amounts[i];
        }
    }

    function _storeMilestones(
        uint256 projectId,
        string[] calldata descriptions,
        uint256[] calldata amounts,
        uint256[] calldata deadlines
    ) internal {
        for (uint256 i = 0; i < amounts.length; i++) {
            Milestone storage milestone = milestones[projectId][i];

            milestone.description = descriptions[i];
            milestone.amount = amounts[i];
            milestone.deadline = deadlines[i];
            milestone.status = MilestoneStatus.Funded;

            emit MilestoneCreated(
                projectId,
                i,
                amounts[i],
                deadlines[i],
                descriptions[i]
            );
        }
    }

    function _settle(
        uint256 projectId,
        uint256 milestoneId,
        uint256 freelancerAmount,
        uint256 clientAmount,
        MilestoneStatus finalStatus
    ) internal {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];

        milestone.status = finalStatus;
        project.remainingBalance -= freelancerAmount + clientAmount;

        if (freelancerAmount > 0) {
            pendingWithdrawals[project.freelancer] += freelancerAmount;
            emit MilestonePaid(
                projectId,
                milestoneId,
                project.freelancer,
                freelancerAmount
            );
        }

        if (clientAmount > 0) {
            pendingWithdrawals[project.client] += clientAmount;
            emit MilestoneRefunded(
                projectId,
                milestoneId,
                project.client,
                clientAmount
            );
        }

        if (project.remainingBalance == 0) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(projectId);
        }
    }
}