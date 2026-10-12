import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther } from "viem";

const DAY = 24 * 60 * 60;

const Status = {
  Funded: 0,
  Submitted: 1,
  Disputed: 2,
  Paid: 3,
  Refunded: 4,
  RevisionRequested: 5,
  Split: 6,
};

async function expectRevert(promise: Promise<any>, reason: string) {
  await assert.rejects(promise, (e: any) => {
    assert.ok(
      String(e?.message ?? e).includes(reason),
      `expected revert "${reason}" but got: ${e?.message}`,
    );
    return true;
  });
}

describe("Escrow", () => {
  let viem: any;
  let time: any;
  let publicClient: any;
  let client: any;
  let freelancer: any;
  let arbitrator: any;
  let stranger: any;
  let escrow: any;

  beforeEach(async () => {
    const connection = await network.connect();
    viem = connection.viem;
    time = connection.networkHelpers.time;
    publicClient = await viem.getPublicClient();

    const accounts = await viem.getWalletClients();
    [client, freelancer, arbitrator, stranger] = accounts;

    escrow = await viem.deployContract("Escrow", [arbitrator.account.address]);
  });

  async function deadlineIn(days: number) {
    return BigInt((await time.latest()) + days * DAY);
  }

  async function createProject() {
    const deadline = await deadlineIn(10);

    await escrow.write.createProject(
      [
        freelancer.account.address,
        ["Design the UI", "Build the application"],
        [parseEther("1"), parseEther("2")],
        [deadline, deadline],
      ],
      { value: parseEther("3"), account: client.account },
    );
  }

  async function submit(milestoneId: bigint, uri = "ipfs://submission") {
    await escrow.write.submitWork([1n, milestoneId, uri], {
      account: freelancer.account,
    });
  }

  async function approve(milestoneId: bigint) {
    await escrow.write.approveMilestone([1n, milestoneId], {
      account: client.account,
    });
  }

  async function dispute(milestoneId: bigint, by = client) {
    await escrow.write.raiseDispute([1n, milestoneId], {
      account: by.account,
    });
  }

  async function milestone(milestoneId: bigint) {
    return escrow.read.getMilestone([1n, milestoneId]);
  }

  async function pending(account: any) {
    return escrow.read.pendingWithdrawals([account.account.address]);
  }

  describe("deployment and arbitrator", () => {
    it("deploys with the correct arbitrator", async () => {
      assert.equal(
        (await escrow.read.arbitrator()).toLowerCase(),
        arbitrator.account.address.toLowerCase(),
      );
    });

    it("rejects a zero address arbitrator", async () => {
      await assert.rejects(
        viem.deployContract("Escrow", [
          "0x0000000000000000000000000000000000000000",
        ]),
      );
    });

    it("hands over the arbitrator role in two steps", async () => {
      await escrow.write.transferOwnership([stranger.account.address], {
        account: arbitrator.account,
      });

      assert.equal(
        (await escrow.read.arbitrator()).toLowerCase(),
        arbitrator.account.address.toLowerCase(),
      );

      await escrow.write.acceptOwnership({ account: stranger.account });

      assert.equal(
        (await escrow.read.arbitrator()).toLowerCase(),
        stranger.account.address.toLowerCase(),
      );
    });

    it("rejects a non-arbitrator starting a handover", async () => {
      await expectRevert(
        escrow.write.transferOwnership([stranger.account.address], {
          account: stranger.account,
        }),
        "OwnableUnauthorizedAccount",
      );
    });

    it("rejects acceptance from an address that was not nominated", async () => {
      await escrow.write.transferOwnership([stranger.account.address], {
        account: arbitrator.account,
      });

      await expectRevert(
        escrow.write.acceptOwnership({ account: client.account }),
        "OwnableUnauthorizedAccount",
      );
    });

    it("disables renouncing the arbitrator role", async () => {
      await expectRevert(
        escrow.write.renounceOwnership({ account: arbitrator.account }),
        "Renounce disabled",
      );
    });
  });

  describe("createProject", () => {
    it("creates a project and locks the exact budget", async () => {
      await createProject();

      assert.equal(await escrow.read.nextProjectId(), 2n);

      const project = await escrow.read.projects([1n]);

      assert.equal(
        project[0].toLowerCase(),
        client.account.address.toLowerCase(),
      );
      assert.equal(
        project[1].toLowerCase(),
        freelancer.account.address.toLowerCase(),
      );
      assert.equal(project[2], parseEther("3"));
      assert.equal(project[3], parseEther("3"));
      assert.equal(project[4], 2n);
      assert.equal(project[5], 0);

      assert.equal(
        await publicClient.getBalance({ address: escrow.address }),
        parseEther("3"),
      );
    });

    it("stores milestone details with Funded status", async () => {
      await createProject();

      const first = await milestone(0n);
      const second = await milestone(1n);

      assert.equal(first.description, "Design the UI");
      assert.equal(first.amount, parseEther("1"));
      assert.equal(first.status, Status.Funded);
      assert.equal(first.submissionURI, "");
      assert.ok(first.deadline > 0n);

      assert.equal(second.description, "Build the application");
      assert.equal(second.amount, parseEther("2"));
      assert.equal(second.status, Status.Funded);
    });

    it("rejects incorrect project funding", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [
            freelancer.account.address,
            ["Design"],
            [parseEther("1")],
            [deadline],
          ],
          { value: parseEther("0.5"), account: client.account },
        ),
        "Incorrect funding amount",
      );
    });

    it("rejects hiring yourself", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [client.account.address, ["Design"], [parseEther("1")], [deadline]],
          { value: parseEther("1"), account: client.account },
        ),
        "Cannot hire yourself",
      );
    });

    it("rejects a zero address freelancer", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [
            "0x0000000000000000000000000000000000000000",
            ["Design"],
            [parseEther("1")],
            [deadline],
          ],
          { value: parseEther("1"), account: client.account },
        ),
        "Invalid freelancer",
      );
    });

    it("rejects the arbitrator as freelancer", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [
            arbitrator.account.address,
            ["Design"],
            [parseEther("1")],
            [deadline],
          ],
          { value: parseEther("1"), account: client.account },
        ),
        "Arbitrator cannot be a party",
      );
    });

    it("rejects the arbitrator as client", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [
            freelancer.account.address,
            ["Design"],
            [parseEther("1")],
            [deadline],
          ],
          { value: parseEther("1"), account: arbitrator.account },
        ),
        "Arbitrator cannot be a party",
      );
    });

    it("rejects an empty milestone list", async () => {
      await expectRevert(
        escrow.write.createProject([freelancer.account.address, [], [], []], {
          value: 0n,
          account: client.account,
        }),
        "No milestones",
      );
    });

    it("rejects mismatched array lengths", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [
            freelancer.account.address,
            ["One", "Two"],
            [parseEther("1")],
            [deadline],
          ],
          { value: parseEther("1"), account: client.account },
        ),
        "Length mismatch",
      );

      await expectRevert(
        escrow.write.createProject(
          [
            freelancer.account.address,
            ["One"],
            [parseEther("1")],
            [deadline, deadline],
          ],
          { value: parseEther("1"), account: client.account },
        ),
        "Length mismatch",
      );
    });

    it("rejects a zero milestone amount", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [freelancer.account.address, ["Design"], [0n], [deadline]],
          { value: 0n, account: client.account },
        ),
        "Amount must be positive",
      );
    });

    it("rejects an empty milestone description", async () => {
      const deadline = await deadlineIn(10);

      await expectRevert(
        escrow.write.createProject(
          [freelancer.account.address, [""], [parseEther("1")], [deadline]],
          { value: parseEther("1"), account: client.account },
        ),
        "Empty description",
      );
    });

    it("rejects a deadline in the past", async () => {
      const past = BigInt((await time.latest()) - 1);

      await expectRevert(
        escrow.write.createProject(
          [freelancer.account.address, ["Design"], [parseEther("1")], [past]],
          { value: parseEther("1"), account: client.account },
        ),
        "Deadline in the past",
      );
    });

    it("rejects more than 20 milestones", async () => {
      const deadline = await deadlineIn(10);
      const descriptions = Array.from({ length: 21 }, (_, i) => `M${i}`);
      const amounts = descriptions.map(() => 1n);
      const deadlines = descriptions.map(() => deadline);

      await expectRevert(
        escrow.write.createProject(
          [freelancer.account.address, descriptions, amounts, deadlines],
          { value: 21n, account: client.account },
        ),
        "Too many milestones",
      );
    });

    it("accepts exactly 20 milestones", async () => {
      const deadline = await deadlineIn(10);
      const descriptions = Array.from({ length: 20 }, (_, i) => `M${i}`);
      const amounts = descriptions.map(() => 1n);
      const deadlines = descriptions.map(() => deadline);

      await escrow.write.createProject(
        [freelancer.account.address, descriptions, amounts, deadlines],
        { value: 20n, account: client.account },
      );

      const project = await escrow.read.projects([1n]);
      assert.equal(project[4], 20n);
    });
  });

  describe("submitWork", () => {
    it("rejects unauthorized work submissions", async () => {
      await createProject();

      await expectRevert(
        escrow.write.submitWork([1n, 0n, "ipfs://example-submission"], {
          account: stranger.account,
        }),
        "Not project freelancer",
      );
    });

    it("rejects the client submitting work", async () => {
      await createProject();

      await expectRevert(
        escrow.write.submitWork([1n, 0n, "ipfs://example-submission"], {
          account: client.account,
        }),
        "Not project freelancer",
      );
    });

    it("rejects an empty submission URI", async () => {
      await createProject();

      await expectRevert(
        escrow.write.submitWork([1n, 0n, ""], {
          account: freelancer.account,
        }),
        "Empty submission URI",
      );
    });

    it("rejects an invalid milestone", async () => {
      await createProject();

      await expectRevert(
        escrow.write.submitWork([1n, 5n, "ipfs://x"], {
          account: freelancer.account,
        }),
        "Invalid milestone",
      );
    });

    it("rejects a non-existent project", async () => {
      await expectRevert(
        escrow.write.submitWork([99n, 0n, "ipfs://x"], {
          account: freelancer.account,
        }),
        "Project does not exist",
      );
    });

    it("rejects submitting after the deadline", async () => {
      await createProject();
      await time.increase(11 * DAY);

      await expectRevert(
        escrow.write.submitWork([1n, 0n, "ipfs://late"], {
          account: freelancer.account,
        }),
        "Deadline passed",
      );
    });

    it("rejects submitting the same milestone twice", async () => {
      await createProject();
      await submit(0n);

      await expectRevert(
        escrow.write.submitWork([1n, 0n, "ipfs://again"], {
          account: freelancer.account,
        }),
        "Milestone not awaiting work",
      );
    });

    it("records the submission", async () => {
      await createProject();
      await submit(0n, "ipfs://work-1");

      const submitted = await milestone(0n);
      assert.equal(submitted.status, Status.Submitted);
      assert.equal(submitted.submissionURI, "ipfs://work-1");
      assert.ok(submitted.submittedAt > 0n);
    });
  });

  describe("approveMilestone", () => {
    it("allows the freelancer to submit work and the client to pay", async () => {
      await createProject();
      await submit(0n);

      const submitted = await milestone(0n);
      assert.equal(submitted.status, Status.Submitted);

      await approve(0n);

      const paid = await milestone(0n);
      assert.equal(paid.status, Status.Paid);

      const project = await escrow.read.projects([1n]);
      assert.equal(project[3], parseEther("2"));
      assert.equal(await pending(freelancer), parseEther("1"));
    });

    it("rejects approval before submission", async () => {
      await createProject();

      await expectRevert(
        escrow.write.approveMilestone([1n, 0n], { account: client.account }),
        "Work not submitted",
      );
    });

    it("rejects approval by anyone but the client", async () => {
      await createProject();
      await submit(0n);

      await expectRevert(
        escrow.write.approveMilestone([1n, 0n], {
          account: freelancer.account,
        }),
        "Not project client",
      );

      await expectRevert(
        escrow.write.approveMilestone([1n, 0n], {
          account: stranger.account,
        }),
        "Not project client",
      );
    });

    it("rejects approving the same milestone twice", async () => {
      await createProject();
      await submit(0n);
      await approve(0n);

      await expectRevert(
        escrow.write.approveMilestone([1n, 0n], { account: client.account }),
        "Work not submitted",
      );

      assert.equal(await pending(freelancer), parseEther("1"));
    });

    it("rejects an invalid milestone", async () => {
      await createProject();

      await expectRevert(
        escrow.write.approveMilestone([1n, 9n], { account: client.account }),
        "Invalid milestone",
      );
    });
  });

  describe("withdraw", () => {
    it("pays out the credited balance to the freelancer", async () => {
      await createProject();
      await submit(0n);
      await approve(0n);

      const before = await publicClient.getBalance({
        address: freelancer.account.address,
      });

      const hash = await escrow.write.withdraw({
        account: freelancer.account,
      });
      const receipt = await publicClient.getTransactionReceipt({ hash });
      const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

      const after = await publicClient.getBalance({
        address: freelancer.account.address,
      });

      assert.equal(after - before + gasCost, parseEther("1"));
      assert.equal(await pending(freelancer), 0n);
      assert.equal(
        await publicClient.getBalance({ address: escrow.address }),
        parseEther("2"),
      );
    });

    it("rejects withdrawing with nothing credited", async () => {
      await expectRevert(
        escrow.write.withdraw({ account: stranger.account }),
        "Nothing to withdraw",
      );
    });

    it("rejects withdrawing twice", async () => {
      await createProject();
      await submit(0n);
      await approve(0n);

      await escrow.write.withdraw({ account: freelancer.account });

      await expectRevert(
        escrow.write.withdraw({ account: freelancer.account }),
        "Nothing to withdraw",
      );
    });

    it("leaves the contract empty once everyone has withdrawn", async () => {
      await createProject();
      await submit(0n);
      await approve(0n);
      await submit(1n);
      await dispute(1n);
      await escrow.write.resolveDispute([1n, 1n, parseEther("0.5")], {
        account: arbitrator.account,
      });

      await escrow.write.withdraw({ account: freelancer.account });
      await escrow.write.withdraw({ account: client.account });

      assert.equal(
        await publicClient.getBalance({ address: escrow.address }),
        0n,
      );
    });
  });

  describe("requestRevision", () => {
    it("moves the milestone to RevisionRequested and allows resubmission", async () => {
      await createProject();
      await submit(0n, "ipfs://v1");

      await escrow.write.requestRevision([1n, 0n, "Fix the header"], {
        account: client.account,
      });

      const revised = await milestone(0n);
      assert.equal(revised.status, Status.RevisionRequested);
      assert.equal(revised.revisionCount, 1);

      await submit(0n, "ipfs://v2");

      const resubmitted = await milestone(0n);
      assert.equal(resubmitted.status, Status.Submitted);
      assert.equal(resubmitted.submissionURI, "ipfs://v2");

      await approve(0n);
      assert.equal((await milestone(0n)).status, Status.Paid);
    });

    it("resets the deadline to the revision window", async () => {
      await createProject();
      await submit(0n);
      await time.increase(3 * DAY);

      await escrow.write.requestRevision([1n, 0n, "Rework"], {
        account: client.account,
      });

      const revised = await milestone(0n);
      const now = BigInt(await time.latest());
      assert.ok(revised.deadline >= now + BigInt(7 * DAY) - 5n);
      assert.ok(revised.deadline <= now + BigInt(7 * DAY) + 5n);
    });

    it("rejects a non-client", async () => {
      await createProject();
      await submit(0n);

      await expectRevert(
        escrow.write.requestRevision([1n, 0n, "Rework"], {
          account: freelancer.account,
        }),
        "Not project client",
      );
    });

    it("rejects revision of unsubmitted work", async () => {
      await createProject();

      await expectRevert(
        escrow.write.requestRevision([1n, 0n, "Rework"], {
          account: client.account,
        }),
        "Work not submitted",
      );
    });

    it("rejects an empty reason", async () => {
      await createProject();
      await submit(0n);

      await expectRevert(
        escrow.write.requestRevision([1n, 0n, ""], {
          account: client.account,
        }),
        "Empty reason",
      );
    });

    it("rejects a revision after the review period", async () => {
      await createProject();
      await submit(0n);
      await time.increase(7 * DAY + 10);

      await expectRevert(
        escrow.write.requestRevision([1n, 0n, "Too late"], {
          account: client.account,
        }),
        "Review period over",
      );
    });

    it("rejects a fourth revision", async () => {
      await createProject();

      for (let i = 0; i < 3; i++) {
        await submit(0n, `ipfs://v${i}`);
        await escrow.write.requestRevision([1n, 0n, `Round ${i}`], {
          account: client.account,
        });
      }

      await submit(0n, "ipfs://v4");

      await expectRevert(
        escrow.write.requestRevision([1n, 0n, "Round 4"], {
          account: client.account,
        }),
        "Revision limit reached",
      );
    });
  });

  describe("refundUnsubmitted", () => {
    it("refunds the client after the deadline passes", async () => {
      await createProject();
      await time.increase(11 * DAY);

      await escrow.write.refundUnsubmitted([1n, 0n], {
        account: client.account,
      });

      assert.equal((await milestone(0n)).status, Status.Refunded);
      assert.equal(await pending(client), parseEther("1"));

      const project = await escrow.read.projects([1n]);
      assert.equal(project[3], parseEther("2"));
    });

    it("rejects a refund before the deadline", async () => {
      await createProject();

      await expectRevert(
        escrow.write.refundUnsubmitted([1n, 0n], { account: client.account }),
        "Deadline not passed",
      );
    });

    it("rejects a refund from anyone but the client", async () => {
      await createProject();
      await time.increase(11 * DAY);

      await expectRevert(
        escrow.write.refundUnsubmitted([1n, 0n], {
          account: freelancer.account,
        }),
        "Not project client",
      );
    });

    it("rejects a refund of submitted work", async () => {
      await createProject();
      await submit(0n);
      await time.increase(11 * DAY);

      await expectRevert(
        escrow.write.refundUnsubmitted([1n, 0n], { account: client.account }),
        "Milestone not awaiting work",
      );
    });

    it("rejects refunding the same milestone twice", async () => {
      await createProject();
      await time.increase(11 * DAY);

      await escrow.write.refundUnsubmitted([1n, 0n], {
        account: client.account,
      });

      await expectRevert(
        escrow.write.refundUnsubmitted([1n, 0n], { account: client.account }),
        "Milestone not awaiting work",
      );
    });

    it("refunds a milestone whose revision window expired", async () => {
      await createProject();
      await submit(0n);

      await escrow.write.requestRevision([1n, 0n, "Rework"], {
        account: client.account,
      });

      await time.increase(8 * DAY);

      await escrow.write.refundUnsubmitted([1n, 0n], {
        account: client.account,
      });

      assert.equal((await milestone(0n)).status, Status.Refunded);
    });
  });

  describe("claimAfterReviewTimeout", () => {
    it("pays the freelancer when the client stays silent", async () => {
      await createProject();
      await submit(0n);
      await time.increase(7 * DAY + 10);

      await escrow.write.claimAfterReviewTimeout([1n, 0n], {
        account: freelancer.account,
      });

      assert.equal((await milestone(0n)).status, Status.Paid);
      assert.equal(await pending(freelancer), parseEther("1"));
    });

    it("rejects a claim before the review period ends", async () => {
      await createProject();
      await submit(0n);

      await expectRevert(
        escrow.write.claimAfterReviewTimeout([1n, 0n], {
          account: freelancer.account,
        }),
        "Review period not over",
      );
    });

    it("rejects a claim from anyone but the freelancer", async () => {
      await createProject();
      await submit(0n);
      await time.increase(7 * DAY + 10);

      await expectRevert(
        escrow.write.claimAfterReviewTimeout([1n, 0n], {
          account: client.account,
        }),
        "Not project freelancer",
      );
    });

    it("rejects a claim on unsubmitted work", async () => {
      await createProject();
      await time.increase(8 * DAY);

      await expectRevert(
        escrow.write.claimAfterReviewTimeout([1n, 0n], {
          account: freelancer.account,
        }),
        "Work not submitted",
      );
    });

    it("rejects claiming twice", async () => {
      await createProject();
      await submit(0n);
      await time.increase(7 * DAY + 10);

      await escrow.write.claimAfterReviewTimeout([1n, 0n], {
        account: freelancer.account,
      });

      await expectRevert(
        escrow.write.claimAfterReviewTimeout([1n, 0n], {
          account: freelancer.account,
        }),
        "Work not submitted",
      );
    });
  });

  describe("raiseDispute", () => {
    it("lets the client dispute submitted work", async () => {
      await createProject();
      await submit(0n);
      await dispute(0n, client);

      const disputed = await milestone(0n);
      assert.equal(disputed.status, Status.Disputed);
      assert.ok(disputed.disputedAt > 0n);
    });

    it("lets the freelancer dispute submitted work", async () => {
      await createProject();
      await submit(0n);
      await dispute(0n, freelancer);

      assert.equal((await milestone(0n)).status, Status.Disputed);
    });

    it("rejects a dispute from a stranger", async () => {
      await createProject();
      await submit(0n);

      await expectRevert(
        escrow.write.raiseDispute([1n, 0n], { account: stranger.account }),
        "Not a project party",
      );
    });

    it("rejects a dispute on unsubmitted work", async () => {
      await createProject();

      await expectRevert(
        escrow.write.raiseDispute([1n, 0n], { account: client.account }),
        "Milestone not submitted",
      );
    });

    it("rejects a dispute after the review period", async () => {
      await createProject();
      await submit(0n);
      await time.increase(7 * DAY + 10);

      await expectRevert(
        escrow.write.raiseDispute([1n, 0n], { account: client.account }),
        "Review period over",
      );
    });

    it("rejects disputing twice", async () => {
      await createProject();
      await submit(0n);
      await dispute(0n);

      await expectRevert(
        escrow.write.raiseDispute([1n, 0n], { account: client.account }),
        "Milestone not submitted",
      );
    });
  });

  describe("resolveDispute", () => {
    async function disputedMilestone() {
      await createProject();
      await submit(0n);
      await dispute(0n);
    }

    it("allows the arbitrator to refund a disputed milestone", async () => {
      await disputedMilestone();

      await escrow.write.resolveDispute([1n, 0n, 0n], {
        account: arbitrator.account,
      });

      assert.equal((await milestone(0n)).status, Status.Refunded);

      const project = await escrow.read.projects([1n]);
      assert.equal(project[3], parseEther("2"));
      assert.equal(await pending(client), parseEther("1"));
      assert.equal(await pending(freelancer), 0n);
    });

    it("allows the arbitrator to pay the freelancer in full", async () => {
      await disputedMilestone();

      await escrow.write.resolveDispute([1n, 0n, parseEther("1")], {
        account: arbitrator.account,
      });

      assert.equal((await milestone(0n)).status, Status.Paid);
      assert.equal(await pending(freelancer), parseEther("1"));
      assert.equal(await pending(client), 0n);
    });

    it("allows the arbitrator to split the milestone", async () => {
      await disputedMilestone();

      await escrow.write.resolveDispute([1n, 0n, parseEther("0.6")], {
        account: arbitrator.account,
      });

      assert.equal((await milestone(0n)).status, Status.Split);
      assert.equal(await pending(freelancer), parseEther("0.6"));
      assert.equal(await pending(client), parseEther("0.4"));

      const project = await escrow.read.projects([1n]);
      assert.equal(project[3], parseEther("2"));
    });

    it("rejects an amount above the milestone amount", async () => {
      await disputedMilestone();

      await expectRevert(
        escrow.write.resolveDispute([1n, 0n, parseEther("1.1")], {
          account: arbitrator.account,
        }),
        "Amount exceeds milestone",
      );
    });

    it("prevents a non-arbitrator from resolving disputes", async () => {
      await disputedMilestone();

      await expectRevert(
        escrow.write.resolveDispute([1n, 0n, parseEther("1")], {
          account: stranger.account,
        }),
        "OwnableUnauthorizedAccount",
      );

      await expectRevert(
        escrow.write.resolveDispute([1n, 0n, parseEther("1")], {
          account: client.account,
        }),
        "OwnableUnauthorizedAccount",
      );
    });

    it("rejects resolving a milestone that is not disputed", async () => {
      await createProject();
      await submit(0n);

      await expectRevert(
        escrow.write.resolveDispute([1n, 0n, 0n], {
          account: arbitrator.account,
        }),
        "Milestone not disputed",
      );
    });

    it("rejects resolving the same dispute twice", async () => {
      await disputedMilestone();

      await escrow.write.resolveDispute([1n, 0n, parseEther("1")], {
        account: arbitrator.account,
      });

      await expectRevert(
        escrow.write.resolveDispute([1n, 0n, parseEther("1")], {
          account: arbitrator.account,
        }),
        "Milestone not disputed",
      );

      assert.equal(await pending(freelancer), parseEther("1"));
    });

    it("rejects an arbitrator who has become a party", async () => {
      await disputedMilestone();

      await escrow.write.transferOwnership([client.account.address], {
        account: arbitrator.account,
      });
      await escrow.write.acceptOwnership({ account: client.account });

      await expectRevert(
        escrow.write.resolveDispute([1n, 0n, 0n], {
          account: client.account,
        }),
        "Arbitrator is a party",
      );
    });
  });

  describe("resolveExpiredDispute", () => {
    async function disputedMilestone() {
      await createProject();
      await submit(0n);
      await dispute(0n);
    }

    it("splits the funds 50/50 after the arbitration timeout", async () => {
      await disputedMilestone();
      await time.increase(30 * DAY + 10);

      await escrow.write.resolveExpiredDispute([1n, 0n], {
        account: freelancer.account,
      });

      assert.equal((await milestone(0n)).status, Status.Split);
      assert.equal(await pending(freelancer), parseEther("0.5"));
      assert.equal(await pending(client), parseEther("0.5"));
    });

    it("gives the odd wei to the client", async () => {
      const deadline = await deadlineIn(10);

      await escrow.write.createProject(
        [freelancer.account.address, ["Odd"], [3n], [deadline]],
        { value: 3n, account: client.account },
      );

      await escrow.write.submitWork([1n, 0n, "ipfs://odd"], {
        account: freelancer.account,
      });
      await dispute(0n);
      await time.increase(30 * DAY + 10);

      await escrow.write.resolveExpiredDispute([1n, 0n], {
        account: client.account,
      });

      assert.equal(await pending(freelancer), 1n);
      assert.equal(await pending(client), 2n);
    });

    it("rejects settlement before the timeout", async () => {
      await disputedMilestone();

      await expectRevert(
        escrow.write.resolveExpiredDispute([1n, 0n], {
          account: client.account,
        }),
        "Arbitration still pending",
      );
    });

    it("rejects settlement by a stranger", async () => {
      await disputedMilestone();
      await time.increase(30 * DAY + 10);

      await expectRevert(
        escrow.write.resolveExpiredDispute([1n, 0n], {
          account: stranger.account,
        }),
        "Not a project party",
      );
    });

    it("rejects settlement of an undisputed milestone", async () => {
      await createProject();
      await submit(0n);
      await time.increase(30 * DAY + 10);

      await expectRevert(
        escrow.write.resolveExpiredDispute([1n, 0n], {
          account: client.account,
        }),
        "Milestone not disputed",
      );
    });

    it("rejects settling twice", async () => {
      await disputedMilestone();
      await time.increase(30 * DAY + 10);

      await escrow.write.resolveExpiredDispute([1n, 0n], {
        account: client.account,
      });

      await expectRevert(
        escrow.write.resolveExpiredDispute([1n, 0n], {
          account: client.account,
        }),
        "Milestone not disputed",
      );
    });
  });

  describe("project completion", () => {
    it("completes the project after every milestone is resolved", async () => {
      await createProject();

      await submit(0n, "ipfs://submission-1");
      await approve(0n);

      await submit(1n, "ipfs://submission-2");
      await approve(1n);

      const project = await escrow.read.projects([1n]);

      assert.equal(project[3], 0n);
      assert.equal(project[5], 1);
    });

    it("emits ProjectCompleted when the last milestone settles", async () => {
      await createProject();
      await submit(0n);
      await approve(0n);
      await submit(1n);
      await approve(1n);

      const events = await escrow.getEvents.ProjectCompleted();
      assert.equal(events.length, 1);
      assert.equal(events[0].args.projectId, 1n);
    });

    it("completes the project after a mix of payment, refund and dispute", async () => {
      await createProject();

      await submit(0n);
      await approve(0n);

      await submit(1n);
      await dispute(1n);
      await escrow.write.resolveDispute([1n, 1n, 0n], {
        account: arbitrator.account,
      });

      const project = await escrow.read.projects([1n]);
      assert.equal(project[3], 0n);
      assert.equal(project[5], 1);

      assert.equal(await pending(freelancer), parseEther("1"));
      assert.equal(await pending(client), parseEther("2"));
    });

    it("blocks further actions on a completed project", async () => {
      await createProject();
      await submit(0n);
      await approve(0n);
      await submit(1n);
      await approve(1n);

      await expectRevert(
        escrow.write.submitWork([1n, 0n, "ipfs://again"], {
          account: freelancer.account,
        }),
        "Project not active",
      );

      await expectRevert(
        escrow.write.approveMilestone([1n, 0n], { account: client.account }),
        "Project not active",
      );

      await expectRevert(
        escrow.write.raiseDispute([1n, 0n], { account: client.account }),
        "Project not active",
      );
    });

    it("keeps the project active while milestones remain", async () => {
      await createProject();
      await submit(0n);
      await approve(0n);

      const project = await escrow.read.projects([1n]);
      assert.equal(project[5], 0);
    });
  });

  describe("project isolation", () => {
    it("keeps funds of separate projects independent", async () => {
      await createProject();
      await createProject();

      await submit(0n);
      await approve(0n);

      const first = await escrow.read.projects([1n]);
      const second = await escrow.read.projects([2n]);

      assert.equal(first[3], parseEther("2"));
      assert.equal(second[3], parseEther("3"));
      assert.equal(
        await publicClient.getBalance({ address: escrow.address }),
        parseEther("6"),
      );
    });
  });
});
