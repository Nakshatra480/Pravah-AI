import { PravahAgent } from "./agent";
import { TaskStatus } from "./types/agent/types";

export { TaskStatus, PravahAgent };
export default PravahAgent;

// For CommonJS compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = PravahAgent;
  module.exports.PravahAgent = PravahAgent;
  module.exports.TaskStatus = TaskStatus;
  module.exports.default = PravahAgent;
}
