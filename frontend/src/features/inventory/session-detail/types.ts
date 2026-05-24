import type { useSessionDetailActions } from "./useSessionDetailActions";
import type { useSessionDetailData } from "./useSessionDetailData";

export type SessionDetailPageModel = ReturnType<typeof useSessionDetailData> &
  ReturnType<typeof useSessionDetailActions>;
