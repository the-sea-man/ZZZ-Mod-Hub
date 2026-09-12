import { useTranslation as useI18nextTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";

export function useTranslation() {
  const { t } = useI18nextTranslation();
  const language = useAppStore((state) => state.language);

  return { t, language };
}
