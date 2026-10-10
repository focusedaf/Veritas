import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("Escrow", () => {
  let viem: any;
  let client: any;
  let freelancer: any;
  let arbitrator: any;
  let stranger: any;
  let escrow: any;

  beforeEach(async () => {
    const connection = await network.connect();
    viem = connection.viem;

    const accounts = await viem.getWalletClients();
    [client, freelancer, arbitrator, stranger] = accounts;

    escrow = await viem.deployContract("Escrow", [
      arbitrator.account.address,
    ]);
  });

  async function createProject() {
    const amounts = [parseEther("1"), parseEther("2")];

    await escrow.write.createProject(
      [
        freelancer.account.address,
        ["Design the UI", "Build the application"],
        amounts,
      ],
      { value: parseEther("3"), account: client.account },
    );
  }

  it("deploys with the correct arbitrator", async () => {
    assert.equal(
      (await escrow.read.arbitrator()).toLowerCase(),
      arbitrator.account.address.toLowerCase(),
    );
  });

  
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
    assert.equal(project[5], 0); // Active
  });

  it("rejects incorrect project funding", async () => {
    await assert.rejects(
      escrow.write.createProject(
        [freelancer.account.address, ["Design"], [parseEther("1")]],
        { value: parseEther("0.5"), account: client.account },
      ),
    );
  });

  it("rejects unauthorized work submissions", async () => {
    await createProject();

    await assert.rejects(
      escrow.write.submitWork([1n, 0n, "ipfs://example-submission"], {
        account: stranger.account,
      }),
    );
  });

  it("allows the freelancer to submit work and the client to pay", async () => {
    await createProject();

    await escrow.write.submitWork([1n, 0n, "ipfs://example-submission"], {
      account: freelancer.account,
    });

    const submitted = await escrow.read.getMilestone([1n, 0n]);
    assert.equal(submitted.status, 1); // Submitted

    await escrow.write.approveMilestone([1n, 0n], {
      account: client.account,
    });

    const paid = await escrow.read.getMilestone([1n, 0n]);
    assert.equal(paid.status, 3); // Paid

    const project = await escrow.read.projects([1n]);
    assert.equal(project[3], parseEther("2"));
  });

  it("allows the arbitrator to refund a disputed milestone", async () => {
    await createProject();

    await escrow.write.submitWork([1n, 0n, "ipfs://example-submission"], {
      account: freelancer.account,
    });

    await escrow.write.raiseDispute([1n, 0n], {
      account: client.account,
    });

    const disputed = await escrow.read.getMilestone([1n, 0n]);
    assert.equal(disputed.status, 2); // Disputed

    await escrow.write.resolveDispute([1n, 0n, false], {
      account: arbitrator.account,
    });

    const refunded = await escrow.read.getMilestone([1n, 0n]);
    assert.equal(refunded.status, 4); // Refunded

    const project = await escrow.read.projects([1n]);
    assert.equal(project[3], parseEther("2"));
  });

  it("prevents a non-arbitrator from resolving disputes", async () => {
    await createProject();

    await escrow.write.submitWork([1n, 0n, "ipfs://example-submission"], {
      account: freelancer.account,
    });

    await escrow.write.raiseDispute([1n, 0n], {
      account: client.account,
    });

    await assert.rejects(
      escrow.write.resolveDispute([1n, 0n, true], {
        account: stranger.account,
      }),
    );
  });

  it("completes the project after every milestone is resolved", async () => {
    await createProject();

    await escrow.write.submitWork([1n, 0n, "ipfs://submission-1"], {
      account: freelancer.account,
    });

    await escrow.write.approveMilestone([1n, 0n], {
      account: client.account,
    });

    await escrow.write.submitWork([1n, 1n, "ipfs://submission-2"], {
      account: freelancer.account,
    });

    await escrow.write.approveMilestone([1n, 1n], {
      account: client.account,
    });

    const project = await escrow.read.projects([1n]);

    assert.equal(project[3], 0n);
    assert.equal(project[5], 1); // Completed
  });
});
