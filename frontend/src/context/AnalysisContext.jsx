import { createContext, useContext, useMemo, useState } from "react";

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const [fileId, setFileId] = useState(null);
  const [extractionId, setExtractionId] = useState(null);
  const [extractedData, setExtractedData] = useState(null); // { skills, projects, education, experience }
  const [assessmentId, setAssessmentId] = useState(null);
  const [latestAnalysis, setLatestAnalysis] = useState(null);

  const resetAnalysisFlow = () => {
    setFileId(null);
    setExtractionId(null);
    setExtractedData(null);
    setAssessmentId(null);
    setLatestAnalysis(null);
  };

  const value = useMemo(
    () => ({
      fileId,
      setFileId,
      extractionId,
      setExtractionId,
      extractedData,
      setExtractedData,
      assessmentId,
      setAssessmentId,
      latestAnalysis,
      setLatestAnalysis,
      resetAnalysisFlow,
    }),
    [fileId, extractionId, extractedData, assessmentId, latestAnalysis]
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysisFlow() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error("useAnalysisFlow must be used within an AnalysisProvider");
  }
  return context;
}
