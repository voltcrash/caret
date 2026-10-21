import { randomUUID } from "node:crypto";
import { isDevEnvironment } from "./misc";
import { MonkeyServerErrorType } from "@oxytype/contracts/util/api";

class MonkeyError extends Error implements MonkeyServerErrorType {
  status: number;
  errorId: string;
  uid?: string;

  constructor(status: number, message?: string, stack?: string, uid?: string) {
    super(message);
    this.status = status ?? 500;
    this.errorId = randomUUID();
    this.stack = stack;
    this.uid = uid;

    if (isDevEnvironment()) {
      this.message =
        (stack ?? "")
          ? `${String(message)}\nStack: ${String(stack)}`
          : String(message);
    } else {
      if ((this.stack ?? "") && this.status >= 500) {
        this.stack = `${this.message}\n${this.stack}`;
        this.message = `Internal Server Error ${this.errorId}`;
      } else {
        this.message = String(message);
      }
    }
  }
}

export default MonkeyError;
