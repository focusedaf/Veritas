export type ProjectRole = "client" | "freelancer" | "arbitrator";

export type MilestoneStatus =
  | "Funded"
  | "Submitted"
  | "Disputed"
  | "Paid"
  | "Refunded"
  | "Revision Requested"
  | "Split"
  | "Unknown";

export type ProjectMilestone = {
  index: number;
  description: string;
  submissionURI: string;
  amountWei: string;
  amountETH: string;
  deadline: number;
  submittedAt: number;
  disputedAt: number;
  revisionCount: number;
  statusCode: number;
  status: MilestoneStatus;
};

export type WalletProject = {
  id: string;
  client: string;
  freelancer: string;
  role: ProjectRole;
};

export type ProjectDetails = WalletProject & {
  milestones: ProjectMilestone[];
  totalAmountWei: string;
  totalAmountETH: string;
};

export type ProjectFilters = {
  search: string;
  role: "all" | ProjectRole;
  status: "all" | MilestoneStatus;
};
