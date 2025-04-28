import './App.css';

import React, {useState, useCallback, useEffect, useRef} from 'react';
import {uploadPdf, checkStatus, askLlm} from './services/api/document.api.ts';
import BlockSelector from './components/block-selector/block-selector.tsx';
import {
  FaCheckCircle,
  FaFileUpload,
  FaQuestionCircle,
  FaRobot
} from 'react-icons/fa';
import {DocumentBlock, DocumentStatus} from "./types/document.types.ts";
import {StatusIcon} from "./components/status-icons/status-icons.tsx";


function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [processedBlocks, setProcessedBlocks] = useState<DocumentBlock[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [processedFileId, setProcessedFileId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [llmResponse, setLlmResponse] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>('idle');
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Select a PDF file to begin.');

  const pollingIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const resetState = useCallback(() => {
    setSelectedFile(null);

    setPrompt('');
    setProcessedBlocks([]);
    setSelectedBlockIds([]);
    setProcessedFileId(null);
    setJobId(null);
    setLlmResponse('');
    setCurrentStatus('idle');
    setError('');
    setStatusMessage('Select a PDF file to begin.');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (fileInputRef.current) {
      console.log("Clearing file input value.");
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input changed.");

    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log(`File selected: ${file.name}, Size: ${file.size}`);

      const maxSizeMB = 50;
      if (file.size > maxSizeMB * 1024 * 1024) {
        console.error(`Validation failed: File too large (${file.size})`);
        setError(`File is too large. Maximum size is ${maxSizeMB}MB.`);
        setStatusMessage(`Error: File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Select another file.`);
        setCurrentStatus('failed');
        setSelectedFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setError('');
      setSelectedFile(file);
      setCurrentStatus('idle');
      setStatusMessage(`Selected file: ${file.name}. Ready to process.`);

      setProcessedBlocks([]);
      setSelectedBlockIds([]);
      setProcessedFileId(null);
      setJobId(null);
      setLlmResponse('');
      setPrompt('');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

    } else {
      console.log("No file selected or selection cancelled.");
      resetState();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const pollStatus = useCallback((fileIdToCheck: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await checkStatus(fileIdToCheck);
        const data = response.data;
        let newMessage = data.message || `Status: ${data.status}`;
        switch (data.status) {
          case 'processed':
            setCurrentStatus('ready_to_ask');
            setProcessedBlocks(data.blocks || []);
            newMessage = `✅ File processed! ${data.blocks?.length || 0} blocks found. Select blocks and enter prompt.`;
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            break;
          case 'failed':
            setCurrentStatus('failed');
            setError(data.error || 'Unknown processing error.');
            newMessage = `❌ Processing failed: ${data.error || 'Unknown error'}`;
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            break;
          case 'processing':
            setCurrentStatus('processing');
            newMessage = `⚙️ Processing PDF with GROBID... (Job: ${jobId || 'N/A'})`;
            break;
          case 'queued':
            setCurrentStatus('polling_status');
            newMessage = `⏳ File queued for processing... (Job: ${jobId || 'N/A'})`;
            break;
          default:
            break;
        }
        setStatusMessage(newMessage);
      } catch (err: any) {
        console.error("Polling error:", err);
        const message = err.response?.data?.message || err.message || 'Error checking status.';
        if (err.response?.status === 404 || err.response?.status >= 500) {
          setError(`Failed to get status: ${message}. Maybe the file ID expired or server issue.`);
          setStatusMessage(`❌ Error checking status. Please try uploading again.`);
          setCurrentStatus('failed');
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        } else {
          setStatusMessage(`⚠️ Warning: Could not check status (${message}). Retrying...`);
        }
      }
    }, 3000);
  }, [jobId]);

  useEffect(() => {
    return () => {
      console.log("App component unmounting, cleaning up interval...");
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }
    resetState();
    setCurrentStatus('uploading');
    setError('');
    setStatusMessage('⬆️ Uploading PDF...');
    try {
      const response = await uploadPdf(selectedFile);
      const {fileId: newFileId, jobId: newJobId, message} = response.data;
      setProcessedFileId(newFileId);
      setJobId(newJobId);
      setCurrentStatus('polling_status');
      setStatusMessage(message || '⏳ File queued. Checking status...');
      pollStatus(newFileId);
    } catch (err: any) {
      console.error("Upload error:", err);
      const message = err.response?.data?.message || err.message || 'Error uploading file.';
      setError(`Upload Error: ${message}`);
      setStatusMessage(`❌ Upload failed: ${message}`);
      setCurrentStatus('failed');
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    }
  };

  const handleAskGemini = async () => {
    if (!processedFileId || currentStatus !== 'ready_to_ask') {
      return;
    }
    if (!prompt.trim()) {
      return;
    }
    if (selectedBlockIds.length === 0) {
      if (!window.confirm("No document blocks selected. The prompt will be sent without document context. Continue?")) return;
    }
    setCurrentStatus('asking_llm');
    setError('');
    setLlmResponse('');
    setStatusMessage('🤖 Asking Gemini...');
    try {
      const response = await askLlm(processedFileId, prompt, selectedBlockIds);
      setLlmResponse(response.data.response);
      setCurrentStatus('processed');
      setStatusMessage('✅ Response received from LLM.');
    } catch (err: any) {
      console.error("LLM error:", err);
      const message = err.response?.data?.message || err.message || 'Error getting response from LLM.';
      setError(`LLM Error: ${message}`);
      setStatusMessage(`❌ LLM Error: ${message}`);
      setCurrentStatus('failed');
    }
  };

  const isProcessingOrAsking = ['uploading', 'polling_status', 'processing', 'asking_llm'].includes(currentStatus);
  const isReadyToAsk = currentStatus === 'ready_to_ask';
  const hasProcessedSuccessfully = currentStatus === 'processed';
  const hasFailed = currentStatus === 'failed';


  return (
    <div className={`App status-${currentStatus}`}>
      <header className="App-header">
        <h1>📄 PDF Article Processor</h1>
        <p>Upload a PDF, select relevant sections, and ask questions using Google Gemini.</p>
      </header>

      <main className="App-main">
        <section
          className={`step step-upload ${selectedFile ? 'step-complete' : ''} ${isProcessingOrAsking ? 'step-disabled' : ''}`}>
          <h2><FaFileUpload className="step-icon"/> 1. Upload PDF</h2>
          <div className="upload-area">
            <label htmlFor="pdf-upload"
                   className={`upload-button ${!selectedFile ? 'button-primary' : 'button-secondary'} ${isProcessingOrAsking ? 'disabled' : ''}`}>
              {selectedFile ? 'Change File' : 'Choose PDF File'}
            </label>
            <input
              ref={fileInputRef}
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isProcessingOrAsking}
              style={{display: 'none'}}
            />
            {selectedFile && <span className="file-name">Selected: {selectedFile.name}</span>}
          </div>
          {selectedFile && currentStatus !== 'ready_to_ask' && !isProcessingOrAsking && (
            <button onClick={handleUpload} disabled={!selectedFile || isProcessingOrAsking}
                    className='button-primary process-button'>
              Process PDF
            </button>
          )}
        </section>

        <section className={`step step-status status-box ${hasFailed ? 'status-box-error' : ''}`}>
          <div className="status-header">
            <StatusIcon status={currentStatus}/>
            <h2>Processing Status</h2>
          </div>
          <p className="status-message">{statusMessage}</p>
          {error && <p className="error-detail">Details: {error}</p>}
          {jobId && <p className="details"><small>Job ID: {jobId}</small></p>}
          {processedFileId && <p className="details"><small>File ID: {processedFileId}</small></p>}
        </section>

        {isReadyToAsk && (
          <section
            className={`step step-select ${selectedBlockIds.length > 0 ? 'step-complete' : ''} ${isProcessingOrAsking || hasProcessedSuccessfully ? 'step-disabled' : ''}`}>
            <h2><FaCheckCircle className="step-icon"/> 2. Select Content Blocks</h2>
            <BlockSelector
              blocks={processedBlocks}
              selectedBlockIds={selectedBlockIds}
              onSelectionChange={setSelectedBlockIds}
              disabled={isProcessingOrAsking || hasProcessedSuccessfully}
            />
          </section>
        )}

        {isReadyToAsk && (
          <section
            className={`step step-ask ${prompt.trim() ? 'step-complete' : ''} ${isProcessingOrAsking || hasProcessedSuccessfully ? 'step-disabled' : ''}`}>
            <h2><FaQuestionCircle className="step-icon"/> 3. Ask Gemini</h2>
            <textarea
              rows={5}
              placeholder="Enter your question or instructions based on the selected blocks..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isProcessingOrAsking || hasProcessedSuccessfully}
            />
            <button onClick={handleAskGemini}
                    disabled={!prompt.trim() || !isReadyToAsk || isProcessingOrAsking || hasProcessedSuccessfully}
                    className='button-primary ask-button'>
              Ask Gemini
            </button>
          </section>
        )}

        {hasProcessedSuccessfully && llmResponse && (
          <section className="step step-result">
            <h2><FaRobot className="step-icon"/> 4. LLM Response</h2>
            <div className="response-area">
              <pre>{llmResponse}</pre>
            </div>
            <button onClick={() => resetState()} className="button-secondary">Start Over</button>
          </section>
        )}
        {hasFailed && (
          <button onClick={() => resetState()} className="button-secondary">Try Again</button>
        )}

      </main>
    </div>
  );
}

export default App;