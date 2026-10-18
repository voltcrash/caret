import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import {
  AddCustomThemeRequest,
  AddCustomThemeResponse,
  DeleteCustomThemeRequest,
  EditCustomThemeRequst,
  GetCustomThemesResponse,
} from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function getCustomThemes(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetCustomThemesResponse> {
  const { uid } = context.actor;
  const customThemes = await UserDAL.getThemes(uid);
  return new MonkeyResponse("Custom themes retrieved", customThemes);
}
export async function addCustomTheme(
  context: ServiceContext,
  input: OperationInput<undefined, AddCustomThemeRequest>,
): Promise<AddCustomThemeResponse> {
  const { uid } = context.actor;
  const { name, colors } = input.body;

  const addedTheme = await UserDAL.addTheme(uid, { name, colors });
  return new MonkeyResponse("Custom theme added", addedTheme);
}
export async function removeCustomTheme(
  context: ServiceContext,
  input: OperationInput<undefined, DeleteCustomThemeRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { themeId } = input.body;
  await UserDAL.removeTheme(uid, themeId);
  return new MonkeyResponse("Custom theme removed", null);
}
export async function editCustomTheme(
  context: ServiceContext,
  input: OperationInput<undefined, EditCustomThemeRequst>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { themeId, theme } = input.body;

  await UserDAL.editTheme(uid, themeId, theme);
  return new MonkeyResponse("Custom theme updated", null);
}
