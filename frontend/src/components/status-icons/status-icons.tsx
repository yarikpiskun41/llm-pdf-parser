import React from "react";
import {DocumentStatus} from "../../types/document.types.ts";
import {FaCheckCircle, FaInfoCircle, FaRobot, FaSpinner, FaTimesCircle} from "react-icons/fa";

export const StatusIcon: React.FC<{ status: DocumentStatus }> = ({status}) => {
  switch (status) {
    case 'uploading':
    case 'polling_status':
    case 'processing':
    case 'asking_llm':
      return <FaSpinner className="icon-spin"/>;
    case 'ready_to_ask':
      return <FaCheckCircle className="icon-success"/>;
    case 'processed':
      return <FaRobot className="icon-info"/>;
    case 'failed':
      return <FaTimesCircle className="icon-error"/>;
    case 'idle':
    default:
      return <FaInfoCircle className="icon-idle"/>;
  }
};