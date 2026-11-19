import * as UserDAL from "../../../dal/user";
import { ApiResponse } from "../../../utils/api-response";
import {
  AddCustomThemeRequest,
  AddCustomThemeResponse,
  DeleteCustomThemeRequest,
  EditCustomThemeRequst,
  GetCustomThemesResponse,
} from "@caret/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function getCustomThemes(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetCustomThemesResponse> {
  const { uid } = context.actor;
  const customThemes = await UserDAL.getThemes(uid);
  return new ApiResponse("Custom themes retrieved", customThemes);
}
export async function addCustomTheme(
  context: ServiceContext,
  input: OperationInput<undefined, AddCustomThemeRequest>,
): Promise<AddCustomThemeResponse> {
  const { uid } = context.actor;
  const { name, colors } = input.body;

  const addedTheme = await UserDAL.addTheme(uid, { name, colors });
  return new ApiResponse("Custom theme added", addedTheme);
}
export async function removeCustomTheme(
  context: ServiceContext,
  input: OperationInput<undefined, DeleteCustomThemeRequest>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const { themeId } = input.body;
  await UserDAL.removeTheme(uid, themeId);
  return new ApiResponse("Custom theme removed", null);
}
export async function editCustomTheme(
  context: ServiceContext,
  input: OperationInput<undefined, EditCustomThemeRequst>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const { themeId, theme } = input.body;

  await UserDAL.editTheme(uid, themeId, theme);
  return new ApiResponse("Custom theme updated", null);
}
