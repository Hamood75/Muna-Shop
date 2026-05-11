import { z } from "zod";
import { ROLES } from "@/lib/constants";

export const setMemberRoleSchema = z.object({
  profileId: z.string().min(1),
  role: z.enum([ROLES.admin, ROLES.staff]),
});

export type SetMemberRoleInput = z.infer<typeof setMemberRoleSchema>;
