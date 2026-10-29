import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionRepository } from "../infrastructure/http-session.repository";
import { ApiProblemException } from "@/shared/types/problem-details.types";

interface ExportDocxParams {
  sessionId: string;
  sessionTitle: string;
}

export const useExportDocx = () => {
  const queryClient = useQueryClient();
  return useMutation<void, ApiProblemException, ExportDocxParams>({
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["wallets", "me"] }),
    mutationKey: ["sessions", "export-docx"],
    mutationFn: async ({ sessionId, sessionTitle }) => {
      const blob = await sessionRepository.downloadDocx(sessionId);

      const sanitizedTitle = sessionTitle
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "")
        .trim();
      const fileName = `Sesion_${sanitizedTitle || "MINEDU"}.docx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    },
  });
};
