import { HttpRequest } from "./http";
import { MonkeyResponse } from "../utils/monkey-response";
import type { ServiceContext, OperationInput } from "../services/context";
import { serviceContext } from "./service-adapter";

export function callService<TQuery, TBody, TParams, TResponse>(
  handler: MonkeyHandler<TQuery, TBody, TParams, TResponse>,
): (all: TypeSafeTsRestRequest<TQuery, TBody, TParams>) => Promise<{
  status: 200;
  body: MonkeyResponse<TResponse>;
}> {
  return async (all) => {
    const result = await handler(serviceContext(all.req), {
      body: all.body as TBody,
      query: all.query as TQuery,
      params: all.params as TParams,
    });
    const response = {
      status: 200 as const,
      body: {
        message: result.message,
        data: result.data,
      },
    };

    return response;
  };
}

type WithBody<T> = {
  body: T;
};
type WithQuery<T> = {
  query: T;
};

type WithParams<T> = {
  params: T;
};

type WithoutBody = {
  body?: never;
};
type WithoutQuery = {
  query?: never;
};
type WithoutParams = {
  params?: never;
};

type MonkeyHandler<TQuery, TBody, TParams, TResponse> = (
  context: ServiceContext,
  input: OperationInput<TQuery, TBody, TParams>,
) => Promise<MonkeyResponse<TResponse>>;

type TypeSafeTsRestRequest<TQuery, TBody, TParams> = {
  req: HttpRequest;
} & (TQuery extends undefined ? WithoutQuery : WithQuery<TQuery>) &
  (TBody extends undefined ? WithoutBody : WithBody<TBody>) &
  (TParams extends undefined ? WithoutParams : WithParams<TParams>);
