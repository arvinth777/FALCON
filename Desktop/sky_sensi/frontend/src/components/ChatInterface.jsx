import { useState } from 'react'
import { Send, MessageSquare, Loader, Lightbulb, Plane, Cloud, AlertTriangle } from 'lucide-react'
import { sendChatMessage } from '../services/api.js'
import SkeletonLoader from './SkeletonLoader'

const ChatInterface = ({ briefingData }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Suggested questions for pilots
  const suggestedQuestions = [
    { icon: Plane, text: "What's the best altitude for this route?", category: "altitude" },
    { icon: Cloud, text: "When will the weather improve?", category: "timing" },
    { icon: AlertTriangle, text: "Are there any icing conditions?", category: "hazards" },
    { icon: MessageSquare, text: "Should I delay this flight?", category: "decision" }
  ];

  // Normalize AI response to ensure consistent structure
  const normalizeAiResponse = (response) => {
    // Handle string responses
    if (typeof response === 'string') {
      return {
        answer: response,
        dataReferences: [],
        recommendations: [],
        confidence: null
      };
    }

    // Handle object responses
    if (response && typeof response === 'object') {
      return {
        answer: response.answer || response.content || response.message || 'No response available',
        dataReferences: Array.isArray(response.dataReferences) ? response.dataReferences : [],
        recommendations: Array.isArray(response.recommendations) ? response.recommendations : [],
        confidence: response.confidence || null
      };
    }

    // Fallback for invalid responses
    return {
      answer: 'Invalid response received',
      dataReferences: [],
      recommendations: [],
      confidence: null
    };
  };

  // Handle sending a message
  const handleSendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim() || !briefingData || isLoading) return;

    const userMessage = { 
      id: Date.now(), 
      type: 'user', 
      content: messageText.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(messageText.trim(), briefingData);
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: normalizeAiResponse(response),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: `Sorry, I couldn't process your question: ${error.message}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Handle suggested question click
  const handleSuggestedQuestion = (question) => {
    handleSendMessage(question);
  };

  // Get confidence color styling
  const getConfidenceColor = (confidence) => {
    switch (confidence?.toUpperCase()) {
      case 'HIGH': return 'text-vfr-500';
      case 'MEDIUM': return 'text-mvfr-500';
      case 'LOW': return 'text-severity-high';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-cockpit-panel rounded-lg border border-gray-600 flex flex-col h-96">
      {/* Header */}
      <div className="p-4 border-b border-gray-600 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-cockpit-accent" />
          <h3 className="text-lg font-semibold text-white">Ask the Weather AI</h3>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Get expert answers about your route conditions
        </p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">Ask me anything about your weather briefing</p>
            
            {/* Suggested Questions */}
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-3">Try these questions:</p>
              <div className="grid grid-cols-1 gap-2">
                {suggestedQuestions.map((question, index) => {
                  const IconComponent = question.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuestion(question.text)}
                      className="flex items-center space-x-3 p-3 bg-cockpit-bg hover:bg-gray-700 rounded-lg text-left transition-colors text-sm"
                      disabled={!briefingData || isLoading}
                    >
                      <IconComponent className="h-4 w-4 text-cockpit-accent flex-shrink-0" />
                      <span className="text-gray-300">{question.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user' 
                    ? 'bg-cockpit-accent text-white'
                    : message.type === 'error'
                    ? 'bg-severity-high/10 border border-severity-high/30 text-severity-high'
                    : 'bg-cockpit-bg text-gray-300 border border-gray-600'
                }`}>
                  {message.type === 'ai' && message.content ? (
                    <div className="space-y-2">
                      <div className="text-sm">
                        {message.content.answer}
                      </div>
                      
                      {/* AI Response Details */}
                      {(message.content.dataReferences?.length > 0 || 
                        message.content.recommendations?.length > 0 || 
                        message.content.confidence) && (
                        <div className="space-y-2">
                          {/* Data References */}
                          {message.content.dataReferences && message.content.dataReferences.length > 0 && (
                            <div className="pt-2 border-t border-gray-600">
                              <p className="text-xs text-gray-400 mb-1">Based on:</p>
                              <ul className="text-xs space-y-1">
                                {message.content.dataReferences.map((ref, index) => (
                                  <li key={index} className="text-gray-400">• {ref}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Recommendations */}
                          {message.content.recommendations && message.content.recommendations.length > 0 && (
                            <div className="pt-2 border-t border-gray-600">
                              <p className="text-xs text-gray-400 mb-1">Recommendations:</p>
                              <ul className="text-xs space-y-1">
                                {message.content.recommendations.map((rec, index) => (
                                  <li key={index} className="text-gray-300">• {rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Confidence */}
                          {message.content.confidence && (
                            <div className="pt-2 border-t border-gray-600 flex justify-end">
                              <span className="text-xs text-gray-400">
                                Confidence: 
                                <span className={`ml-1 ${getConfidenceColor(message.content.confidence)}`}>
                                  {message.content.confidence}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm">{message.content}</div>
                  )}
                  
                  <div className="mt-2 text-xs opacity-60">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <SkeletonLoader type="chat-message" className="max-w-[80%]" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-gray-600 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about weather conditions, altitude, timing..."
            className="flex-1 px-3 py-2 bg-cockpit-bg border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent text-sm"
            disabled={!briefingData || isLoading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || !briefingData || isLoading}
            className="px-4 py-2 bg-cockpit-accent text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        
        {!briefingData && (
          <p className="text-xs text-gray-500 mt-2">
            Get a weather briefing first to enable AI chat
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;