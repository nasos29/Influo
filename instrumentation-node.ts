import { resumeCategoryEmailQueue } from "@/lib/campaignCategoryEmail";

// Resume the persisted campaign category email queue after a deploy/restart.
setTimeout(() => resumeCategoryEmailQueue(), 30_000);
