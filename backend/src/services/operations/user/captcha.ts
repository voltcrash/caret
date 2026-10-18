import type { CaptchaAction } from "@oxytype/contracts/captcha";
import MonkeyError from "../../../utils/error";
import { verify } from "../../../utils/captcha";
import { tryCatch } from "@oxytype/util/trycatch";

export async function verifyCaptcha(
  captcha: string,
  action: CaptchaAction,
): Promise<void> {
  const { data: verified, error } = await tryCatch(verify(captcha, action));
  if (error) {
    throw new MonkeyError(
      422,
      "Request to the Captcha API failed, please try again later",
    );
  }
  if (!verified) {
    throw new MonkeyError(422, "Captcha challenge failed");
  }
}
