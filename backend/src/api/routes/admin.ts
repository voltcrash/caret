// import joi from "joi";

import * as AdminService from "../../services/operations/admin";
import { adminContract } from "@oxytype/contracts/admin";
import { initServer } from "../hono-adapter";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(adminContract, {
  test: {
    handler: async (r) => callService(AdminService.test)(r),
  },
  toggleBan: {
    handler: async (r) => callService(AdminService.toggleBan)(r),
  },
  clearStreakHourOffset: {
    handler: async (r) => callService(AdminService.clearStreakHourOffset)(r),
  },
  deleteUser: {
    handler: async (r) => callService(AdminService.deleteUser)(r),
  },
  acceptReports: {
    handler: async (r) => callService(AdminService.acceptReports)(r),
  },
  rejectReports: {
    handler: async (r) => callService(AdminService.rejectReports)(r),
  },
  clearSuspicious: {
    handler: async (r) => callService(AdminService.clearSuspicious)(r),
  },
  getAnticheatAudits: {
    handler: async (r) => callService(AdminService.getAnticheatAudits)(r),
  },
  getAnticheatSummary: {
    handler: async (r) => callService(AdminService.getAnticheatSummary)(r),
  },
});
