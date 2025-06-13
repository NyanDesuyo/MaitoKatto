import { inspect } from "node:util";

export class Helper {
  static uptime() {
    const seconds = Math.floor(process.uptime());
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  }

  static consoleInspect(data: any) {
    // eslint-disable-next-line no-console
    console.log(inspect(data, { depth: null }));
  }
}
