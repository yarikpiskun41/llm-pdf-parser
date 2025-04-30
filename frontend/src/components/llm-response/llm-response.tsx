import "./llm-response.css"
import Markdown from 'react-markdown'

export const LlmResponse: React.FC<{response: string}>  = ({response}) => {
  return (
    <div className="response-container">
      <div className="response-header">
        <h3>LLM Response:</h3>
      </div>
      <div className="response-content">
        <Markdown>
          {response}
        </Markdown>
      </div>
    </div>
  );
}