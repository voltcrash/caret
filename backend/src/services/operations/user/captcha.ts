import type { CaptchaAction } from "@caret/contracts/captcha";
import ApiError from "../../../utils/error";
import { verify } from "../../../utils/captcha";
import { tryCatch } from "@caret/util/trycatch";

export async function verifyCaptcha(
  captcha: string,
  action: CaptchaAction,
): Promise<void> {
  const { data: verified, error } = await tryCatch(verify(captcha, action));
  if (error) {
    throw new ApiError(
      422,
      "Request to the Captcha API failed, please try again later",
    );
  }
  if (!verified) {
    throw new ApiError(422, "Captcha challenge failed");
  }
}
