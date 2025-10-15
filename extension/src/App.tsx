import { useState, useEffect, useRef } from 'react'
import './App.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'

// Message type definition
interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Proxy server URL - update this after deploying to Vercel
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://pserver-six.vercel.app';

// Custom pre component with copy button for code blocks
const PreBlock = ({ children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const codeRef = useRef<string>('');
  
  // Extract plain text from the code element
  useEffect(() => {
    if (preRef.current) {
      const codeElement = preRef.current.querySelector('code');
      if (codeElement) {
        // Get clean text without line numbers or formatting artifacts
        let text = codeElement.textContent || '';
        // Remove any line numbers that might be present (common pattern: "1 " at start of lines)
        text = text.replace(/^\s*\d+\s+/gm, '');
        codeRef.current = text;
      } else {
        codeRef.current = preRef.current.textContent || '';
      }
    }
  }, [children]);
  
  const copyToClipboard = async () => {
    try {
      const textToCopy = codeRef.current || preRef.current?.textContent || '';
      
      if (textToCopy) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="code-block-container">
      <pre ref={preRef} {...props}>
        {children}
      </pre>
      <button 
        className={`copy-button ${copied ? 'copied' : ''}`}
        onClick={copyToClipboard}
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
};

// Custom code component for inline code
const CodeInline = ({ children, className, ...props }: any) => {
  return <code className={className} {...props}>{children}</code>;
};

// Add type definition for Chrome API
declare global {
  interface Window {
    chrome: {
      tabs: {
        captureVisibleTab: (
          windowId: number | null,
          options: { format: string, quality: number },
          callback: (dataUrl: string) => void
        ) => void;
        query: (
          queryInfo: { active: boolean, currentWindow: boolean },
          callback: (tabs: { id: number }[]) => void
        ) => void;
        executeScript: (
          tabId: number,
          details: { code: string } | { file: string },
          callback?: (result: any[]) => void
        ) => void;
      },
      runtime: {
        lastError?: {
          message?: string;
        },
        sendMessage: (
          message: any,
          callback?: (response: any) => void
        ) => void;
        onMessage: {
          addListener: (
            callback: (
              message: any,
              sender: any,
              sendResponse: (response?: any) => void
            ) => void
          ) => void;
        },
        getURL: (path: string) => string;
      }
    }
  }
}

function App() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [currentInput, setCurrentInput] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python')
  const [currentProblemContext, setCurrentProblemContext] = useState<string>('')
  
  // Check if we're running in a Chrome extension context
  const [isExtension, setIsExtension] = useState(false)
  
  // Refs for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // Check if we're in a Chrome extension
    if (window.chrome && window.chrome.runtime) {
      setIsExtension(true)
    } else {
      setErrorDetails('Not running in Chrome extension context. Please load as extension.')
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Helper function to add messages
  const addMessage = (type: 'user' | 'assistant' | 'system', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
    return newMessage.id
  }

  // Helper function to update the last assistant message (for streaming)
  const updateLastAssistantMessage = (content: string) => {
    setMessages(prev => {
      const updated = [...prev]
      const lastIndex = updated.length - 1
      if (lastIndex >= 0 && updated[lastIndex].type === 'assistant') {
        updated[lastIndex] = { ...updated[lastIndex], content }
      }
      return updated
    })
  }

  // Simple testMode that uses a sample image for OCR testing
  const useTestImage = async () => {
    const testImageUrl = 'data:image/png;base64,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';
    
    return testImageUrl;
  };

  const captureCurrentTab = async (): Promise<string | null> => {
    try {
      setErrorDetails('');
      setIsProcessing(true);
      
      // If in test mode, use a sample image
      if (false) {
        return await useTestImage();
      }
      
      // If we are in a Chrome extension, use the tabs API
      if (!window.chrome || !window.chrome.tabs) {
        const error = 'Chrome API not available. Are you running as an extension?';
        setErrorDetails(error);
        return null;
      }
      
      // Return a promise that will resolve with the data URL
      return new Promise((resolve) => {
        window.chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentTab = tabs[0];
          if (!currentTab || !currentTab.id) {
            setErrorDetails('No active tab found');
            resolve(null);
            return;
          }
          
          // Use chrome.tabs.captureVisibleTab as a fallback
          window.chrome.tabs.captureVisibleTab(
            null,
            { format: 'png', quality: 100 },
            (dataUrl) => {
              if (window.chrome.runtime.lastError) {
                setErrorDetails(`Tab capture error: ${window.chrome.runtime.lastError.message || 'Unknown error'}`);
                resolve(null);
                return;
              }
              
              resolve(dataUrl);
            }
          );
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setErrorDetails(`Tab capture error: ${errorMessage}`);
      return null;
    }
  };

  const recognizeText = async (imageUrl: string) => {
    try {
      // Call proxy server instead of Google Vision API directly
      const base64Image = imageUrl.split(',')[1];
      
      const response = await fetch(`${PROXY_URL}/api/vision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1
                }
              ]
            }
          ]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Proxy Server Error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      const text = result.responses[0]?.textAnnotations?.[0]?.description || '';
      
      // Update UI with extracted text
      if (!text || text.trim() === '') {
        setErrorDetails('No text was found in the image. Try again with a different page.');
      } else {
        // Store the problem context for follow-up questions
        setCurrentProblemContext(text);
        
        // Automatically analyze with LLM after successful text extraction
        try {
          await callOpenAIO3Mini(text, true);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          setErrorDetails(`LLM error: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setErrorDetails(`OCR error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapture = async () => {
    try {
      setIsProcessing(true);
      const imageUrl = await captureCurrentTab();
      if (imageUrl) {
        await recognizeText(imageUrl);
      } else {
        setIsProcessing(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setErrorDetails(`Error: ${errorMessage}`);
      setIsProcessing(false);
    }
  };

  const callOpenAIO3Mini = async (extractedText: string, _isInitialProblem: boolean = false) => {
    try {
      // Show loading state
      setIsProcessing(true);
      
      // Preprocess the extracted text to better highlight code blocks
      const processedText = preprocessProblemText(extractedText);
      
      // Generate the solution using proxy server
      const response = await fetch(`${PROXY_URL}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", 
          stream: true, 
          messages: [
            {
              role: "system",
              content: `**System Prompt - LeetCode Solution Assistant**

You are an expert AI that generates flawless LeetCode solutions in STRICT MARKDOWN FORMAT. For every coding problem:

**CRITICAL: ALL OUTPUT MUST USE PROPER MARKDOWN SYNTAX**

**LANGUAGE: Generate the solution in ${selectedLanguage.toUpperCase()}**

1. **REQUIRED SECTIONS** (in this exact order with EXACT markdown headers):
   ## 🧐 Problem Summary
    - Give a detailed but not overly wordy summary of the problem, you should clearly state what the problem is asking for. 
   ## ✅ Solution
    - Please provide the solution for the inputted problem in ${selectedLanguage.toUpperCase()}, when generating the code please pertain to the rules in the "CODE FORMATTING RULES"
   ### ⏱️ Time Complexity: $\\mathcal{O}(actual_complexity)$
    - Please provide a detailed explanation as to why the time complexities is what it is, 2-3 sentences should suffice. Make sure to wrap the complexity notation in backticks like \`O(n)\` or \`O(log n)\` so it appears in code formatting. IMPORTANT: In your header, use the format "### ⏱️ Time Complexity: $\\mathcal{O}(actual_complexity)$" where you replace "actual_complexity" with the real complexity like "n" or "log n".
   ### 📦 Space Complexity: $\\mathcal{O}(actual_complexity)$
    - Please provide a detailed explanation as to why the space complexities is what it is, 2-3 sentences should suffice. Make sure to wrap the complexity notation in backticks like \`O(1)\` or \`O(n)\` so it appears in code formatting. IMPORTANT: In your header, use the format "### 📦 Space Complexity: $\\mathcal{O}(actual_complexity)$" where you replace "actual_complexity" with the real complexity like "1" or "n".
   ## ✍️ Concrete Example
    please provide an example to help the user understand the logic, anticipate steps that are complex and could cause confusion and explain such steps 
   ## 🤓 Problem Giveaways
    - **"Quote 1 from the problem that was a giveaway to use the technique you chose"** 
        - How it helped you identify the correct technique to use, the purpose is to help users recognize these patterns for future interviews, thus anticipate similar quotes to look for that could be giveaway to use the same technqiue, THIS IS CRITICAL PLEASE INCLUDE THIS provide specific examples of variations of this quote that could hint as using the same technique. 
    
    - **"Quote 2 from the problem that was a giveaway to use the technique you chose"** 
        - How it helped you identify the correct technique to use, the purpose is to help users recognize these patterns for future interviews, thus anticipate similar quotes to look for that could be giveaway to use the same technqiue, THIS IS CRITICAL PLEASE INCLUDE THIS provide specific examples of variations of this quote that could hint as using the same technique. 

    - **"Quote 3 from the problem that was a giveaway to use the technique you chose"** 
        - How it helped you identify the correct technique to use, the purpose is to help users recognize these patterns for future interviews, thus anticipate similar quotes to look for that could be giveaway to use the same technqiue, THIS IS CRITICAL PLEASE INCLUDE THIS provide specific examples of variations of this quote that could hint as using the same technique. 
   ## 💪 Similar Problems
     
     - Similar problem 1
     - Similar problem 2
     - Similar problem 3 

**IMPORTANT: Do NOT include the current problem itself in the Similar Problems section. Only suggest OTHER problems that use similar techniques or concepts.**

**FORMAT SIMILAR PROBLEMS AS LINKS: Use this exact format for similar problems:**
- [Problem Number. Problem Name](https://leetcode.com/problems/problem-slug/)

**Example:**
- [15. 3Sum](https://leetcode.com/problems/3sum/)
- [167. Two Sum II - Input Array is Sorted](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/)
- [18. 4Sum](https://leetcode.com/problems/4sum/)

2. **MARKDOWN FORMATTING RULES**:
   - ALWAYS use ## for main headers
   - ALWAYS use ### for sub-headers  
   - ALWAYS wrap code in \`\`\`${selectedLanguage} code blocks
   - Use **bold** for emphasis
   - Use - for bullet points
   - Use proper markdown syntax throughout

3. **CODE FORMATTING RULES**:
   \`\`\`${selectedLanguage}
   # MUST:
   - Use exact starter code from problem if available
   - Include all imports/includes needed
   - Proper indentation (4 spaces for Python, 2 spaces for JavaScript, etc.)
   - One statement per line
   - Type hints/annotations if the language supports them
   - Proper closing brackets
   - Comments if helpful for understanding
   \`\`\`

**YOU MUST FOLLOW THIS EXACT FORMAT WITH PROPER MARKDOWN SYNTAX AND GENERATE CODE IN ${selectedLanguage.toUpperCase()} ONLY.**`
            },
            {
              role: "user",
              content: `Please solve this LeetCode problem and provide a comprehensive solution:

${processedText}

IMPORTANT: Do NOT include this current problem in your "Similar Problems" section. Only suggest OTHER different problems that use similar techniques.`
            }
          ],
          max_completion_tokens: 2000 
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proxy Server Error: ${response.status} - ${errorText}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }
      
      let fullSolution = '';
      const decoder = new TextDecoder();
      
      // Add initial assistant message for streaming
      addMessage('assistant', '');
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                return fullSolution;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  fullSolution += content;
                  updateLastAssistantMessage(fullSolution); // Update UI in real-time
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      return fullSolution;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle follow-up questions
  const sendFollowUpQuestion = async () => {
    if (!currentInput.trim() || isProcessing) return;
    
    // Add user message
    addMessage('user', currentInput);
    const userQuestion = currentInput;
    setCurrentInput('');
    
    try {
      setIsProcessing(true);
      
      // Build conversation context for the AI
      const conversationHistory = messages
        .filter(msg => msg.type !== 'system')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));
      
      // Add the current question
      conversationHistory.push({
        role: 'user',
        content: userQuestion
      });
      
      const response = await fetch(`${PROXY_URL}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", 
          stream: true, 
          messages: [
            {
              role: "system",
              content: `You are an expert coding assistant helping with LeetCode problems. The user has already received a solution and is now asking follow-up questions about it.

**CRITICAL: ALL OUTPUT MUST USE PROPER MARKDOWN SYNTAX**

**LANGUAGE: When providing code examples, use ${selectedLanguage.toUpperCase()}**

Context about the original problem:
${currentProblemContext ? `\`\`\`\n${currentProblemContext}\n\`\`\`` : 'No problem context available'}

Guidelines for follow-up responses:
1. Be concise and focused on the specific question
2. Use proper markdown formatting with ## for headers, ### for subheaders
3. Wrap code in \`\`\`${selectedLanguage} code blocks
4. If explaining concepts, provide clear examples
5. If the user asks for variations, provide complete working solutions
6. If they ask about complexity, be specific with mathematical notation using $\\mathcal{O}(n)$ format
7. Reference the original solution when relevant

Remember: This is a follow-up conversation, so you can reference previous parts of the discussion.`
            },
            ...conversationHistory
          ],
          max_completion_tokens: 1500 
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proxy Server Error: ${response.status} - ${errorText}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }
      
      let fullResponse = '';
      const decoder = new TextDecoder();
      
      // Add initial assistant message for streaming
      addMessage('assistant', '');
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  fullResponse += content;
                  updateLastAssistantMessage(fullResponse);
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addMessage('assistant', `❌ **Error**: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowUpQuestion();
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <h1>🐐 LeetGoat</h1>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Chat Area */}
        <div className="chat-area" ref={chatAreaRef}>
          {!isExtension && (
            <div className="error-details">
              Chrome extension APIs required. Run as extension.
            </div>
          )}
          
          {messages.length === 0 && !errorDetails && isExtension && (
            <div className="empty-state">
              <div className="empty-state-icon">🧠</div>
              <div className="empty-state-text">Ready to solve problems!</div>
              <div className="empty-state-subtext">Capture a coding problem to get started</div>
            </div>
          )}
          
          {/* Render conversation messages */}
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                <div className="simple-markdown">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeHighlight, rehypeKatex]}
                    components={{
                      pre: PreBlock,
                      code: CodeInline
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="message-timestamp">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {errorDetails && errorDetails.trim() !== '' && (
            <div className="error-details">
              <strong>Error:</strong> {errorDetails}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-area">
          <div className="input-container">
            <div className="language-selector">
              <span className="language-label">Language:</span>
              <select 
                id="language-select"
                className="language-dropdown"
                value={selectedLanguage} 
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={isProcessing}
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="typescript">TypeScript</option>
                <option value="swift">Swift</option>
                <option value="kotlin">Kotlin</option>
              </select>
            </div>
            
            <button 
              onClick={handleCapture} 
              disabled={isProcessing}
              className="capture-button"
            >
              {isProcessing ? '🔄 Processing...' : '📸 Capture & Analyze'}
            </button>
          </div>
          
          {/* Follow-up question input - only show if we have messages */}
          {messages.length > 0 && (
            <div className="followup-container">
              <div className="followup-input-wrapper">
                <textarea
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask a follow-up question... (e.g., 'Can you explain the time complexity?', 'Show me a different approach', 'What if the input was sorted?')"
                  className="followup-input"
                  disabled={isProcessing}
                  rows={2}
                />
                <button 
                  onClick={sendFollowUpQuestion}
                  disabled={isProcessing || !currentInput.trim()}
                  className="send-button"
                >
                  {isProcessing ? '⏳' : '➤'}
                </button>
              </div>
              <div className="followup-hint">
                💡 Try asking: "Explain the algorithm", "Show alternative solution", "What's the space complexity?", "How to optimize this?"
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Preprocesses problem text to better identify and format code blocks
 * to make it easier for the AI to recognize starter code
 */
const preprocessProblemText = (text: string): string => {
  if (!text) return '';

  // Basic code block identification - only wrapping obvious Python code in backticks
  const lines = text.split('\n');
  let inCodeBlock = false;
  let result = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Already identified code blocks with ``` markers
    if (line.trim().startsWith('```') || line.trim() === '```') {
      inCodeBlock = !inCodeBlock;
      result += line + '\n';
      continue;
    }

    // Check for obvious Python code that's not already in a code block
    if (!inCodeBlock && 
        (line.trim().startsWith('def ') || 
         line.trim().startsWith('class ') || 
         line.trim().startsWith('import ') ||
         line.trim().startsWith('from '))) {
      // Start a code block
      result += '```python\n' + line + '\n';
      inCodeBlock = true;
      
      // Include subsequent indented lines in the code block
      let j = i + 1;
      while (j < lines.length && 
             (lines[j].trim() === '' || lines[j].search(/\S/) > line.search(/\S/))) {
        result += lines[j] + '\n';
        j++;
      }
      
      // Close the code block
      result += '```\n';
      i = j - 1; // Skip processed lines
      inCodeBlock = false;
    } else if (inCodeBlock) {
      // Continue existing code block
      result += line + '\n';
    } else {
      // Normal line
      result += line + '\n';
    }
  }

  // Close any open code block at the end
  if (inCodeBlock) {
    result += '```\n';
  }

  return result;
};

export default App
