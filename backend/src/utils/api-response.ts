import { ApiResponseType } from "@caret/contracts/util/api";

type ApiDataAware<T> = {
  data: T | null;
};

export class ApiResponse<T = null> implements ApiResponseType, ApiDataAware<T> {
  public message: string;
  public data: T;

  constructor(message: string, data: T) {
    this.message = message;
    this.data = data;
  }
}
