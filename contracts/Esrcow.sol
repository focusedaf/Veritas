
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Escrow is ReentrancyGuard {
    enum ProjectStatus {
        Active,
        Completed
    }

    enum MilestoneStatus {
        Funded,
        Submitted,
        Disputed,
        Paid,
        Refunded
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
        MilestoneStatus status;
    }

    address public arbitrator;
    uint256 public nextProjectId = 1;

    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => Milestone))
        public milestones;

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
        string description
    );

    event WorkSubmitted(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        string submissionURI
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
        bool paidToFreelancer
    );

    event ProjectCompleted(uint256 indexed projectId);

    event ArbitratorChanged(
        address indexed oldArbitrator,
        address indexed newArbitrator
    );

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

    modifier validProject(uint256 projectId) {
        require(
            projects[projectId].client != address(0),
            "Project does not exist"
        );
        _;
    }

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "Not arbitrator");
        _;
    }

    constructor(address initialArbitrator) {
        require(
            initialArbitrator != address(0),
            "Invalid arbitrator"
        );
        arbitrator = initialArbitrator;
    }

    /// @notice Create a project and lock its entire milestone budget.
    /// @dev msg.value must exactly equal the sum of all milestone amounts.
    function createProject(
        address payable freelancer,
        string[] calldata descriptions,
        uint256[] calldata amounts
    ) external payable nonReentrant returns (uint256 projectId) {
        require(freelancer != address(0), "Invalid freelancer");
        require(freelancer != msg.sender, "Cannot hire yourself");
        require(descriptions.length > 0, "No milestones");
        require(descriptions.length == amounts.length, "Length mismatch");
        require(descriptions.length <= 20, "Too many milestones");

        uint256 total;

        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be positive");
            total += amounts[i];
        }

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

        for (uint256 i = 0; i < amounts.length; i++) {
            milestones[projectId][i] = Milestone({
                description: descriptions[i],
                submissionURI: "",
                amount: amounts[i],
                status: MilestoneStatus.Funded
            });

            emit MilestoneCreated(
                projectId,
                i,
                amounts[i],
                descriptions[i]
            );
        }

        emit ProjectCreated(
            projectId,
            msg.sender,
            freelancer,
            total
        );
    }

    /// @notice Submit work for a funded milestone.
    function submitWork(
        uint256 projectId,
        uint256 milestoneId,
        string calldata submissionURI
    )
        external
        validProject(projectId)
        onlyFreelancer(projectId)
    {
        Project storage project = projects[projectId];
        Milestone storage milestone =
            milestones[projectId][milestoneId];

        require(
            project.status == ProjectStatus.Active,
            "Project not active"
        );
        require(
            milestoneId < project.milestoneCount,
            "Invalid milestone"
        );
        require(
            milestone.status == MilestoneStatus.Funded,
            "Milestone not awaiting work"
        );
        require(bytes(submissionURI).length > 0, "Empty submission URI");

        milestone.submissionURI = submissionURI;
        milestone.status = MilestoneStatus.Submitted;

        emit WorkSubmitted(projectId, milestoneId, submissionURI);
    }

    /// @notice Client approves submitted work and pays the freelancer.
    function approveMilestone(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        validProject(projectId)
        onlyClient(projectId)
        nonReentrant
    {
        Project storage project = projects[projectId];
        Milestone storage milestone =
            milestones[projectId][milestoneId];

        require(
            project.status == ProjectStatus.Active,
            "Project not active"
        );
        require(
            milestoneId < project.milestoneCount,
            "Invalid milestone"
        );
        require(
            milestone.status == MilestoneStatus.Submitted,
            "Work not submitted"
        );

        uint256 amount = milestone.amount;
        milestone.status = MilestoneStatus.Paid;
        project.remainingBalance -= amount;

        (bool success, ) = project.freelancer.call{value: amount}("");
        require(success, "Freelancer payment failed");

        emit MilestonePaid(
            projectId,
            milestoneId,
            project.freelancer,
            amount
        );

        _updateProjectCompletion(projectId);
    }

    /// @notice Either party can dispute a submitted milestone.
    function raiseDispute(
        uint256 projectId,
        uint256 milestoneId
    ) external validProject(projectId) {
        Project storage project = projects[projectId];
        Milestone storage milestone =
            milestones[projectId][milestoneId];

        require(
            msg.sender == project.client ||
            msg.sender == project.freelancer,
            "Not a project party"
        );
        require(
            project.status == ProjectStatus.Active,
            "Project not active"
        );
        require(
            milestoneId < project.milestoneCount,
            "Invalid milestone"
        );
        require(
            milestone.status == MilestoneStatus.Submitted,
            "Milestone not submitted"
        );

        milestone.status = MilestoneStatus.Disputed;

        emit DisputeRaised(projectId, milestoneId, msg.sender);
    }

    /// @notice Arbitrator decides who receives the disputed milestone funds.
    /// @param payFreelancer True pays the freelancer; false refunds the client.
    function resolveDispute(
        uint256 projectId,
        uint256 milestoneId,
        bool payFreelancer
    )
        external
        validProject(projectId)
        onlyArbitrator
        nonReentrant
    {
        Project storage project = projects[projectId];
        Milestone storage milestone =
            milestones[projectId][milestoneId];

        require(
            project.status == ProjectStatus.Active,
            "Project not active"
        );
        require(
            milestoneId < project.milestoneCount,
            "Invalid milestone"
        );
        require(
            milestone.status == MilestoneStatus.Disputed,
            "Milestone not disputed"
        );

        uint256 amount = milestone.amount;

        // Update state before transferring funds.
        milestone.status = payFreelancer
            ? MilestoneStatus.Paid
            : MilestoneStatus.Refunded;

        project.remainingBalance -= amount;

        address payable recipient = payFreelancer
            ? project.freelancer
            : project.client;

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");

        if (payFreelancer) {
            emit MilestonePaid(
                projectId,
                milestoneId,
                project.freelancer,
                amount
            );
        } else {
            emit MilestoneRefunded(
                projectId,
                milestoneId,
                project.client,
                amount
            );
        }

        emit DisputeResolved(
            projectId,
            milestoneId,
            payFreelancer
        );

        _updateProjectCompletion(projectId);
    }

    /// @notice Change the trusted dispute resolver.
    /// @dev The current arbitrator is the only address authorized to do this.
    function setArbitrator(address newArbitrator) external onlyArbitrator {
        require(newArbitrator != address(0), "Invalid arbitrator");

        address oldArbitrator = arbitrator;
        arbitrator = newArbitrator;

        emit ArbitratorChanged(oldArbitrator, newArbitrator);
    }

    function getMilestone(
        uint256 projectId,
        uint256 milestoneId
    )
        external
        view
        validProject(projectId)
        returns (Milestone memory)
    {
        require(
            milestoneId < projects[projectId].milestoneCount,
            "Invalid milestone"
        );
        return milestones[projectId][milestoneId];
    }

    function _updateProjectCompletion(uint256 projectId) internal {
        Project storage project = projects[projectId];

        if (project.remainingBalance == 0) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(projectId);
        }
    }
}
