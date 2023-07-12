import { useState, useEffect, useImperativeHandle } from 'react';
import { ChatMessage } from '@/lib/Utils';
import styles from 'styles/Page.module.css';

export default function Chat({ messageHistory, sendMessage }: {messageHistory: ChatMessage[], sendMessage: (message: string) => void}) {
  const [message, setMessage] = useState('');

  const handleChange = (event) => {
    setMessage(event.target.value);
  };

  const handleKeyDown = (event) => {
    if (event.key == "Enter" && message.length > 0) {
      console.log(message);
      sendMessage(message);
      setMessage('');
    }
  }

  const messages = messageHistory.map((message, index) => {
    if (message.sender === "server") {
      return (
        <li className={styles.chatMessage} key={index}>
          <span className={styles.chatSender}>[server]: </span><span style={{fontWeight: "bold"}}>{message.message}</span>
        </li>
      );
    }
    return (
      <li className={styles.chatMessage} key={index}>
        <span className={styles.chatSender}>{'[' + message.sender + "]: "}</span>{message.message}
      </li>
    );
  });

  return (
    <div className={styles.chat}>
      <ol className={styles.chatHistory}>{messages}</ol>
      <input 
        className={styles.chatBox}
        type="text" 
        id="chat" 
        name="chat" 
        onChange={handleChange}
        onKeyDown={handleKeyDown} 
        value={message} 
        maxLength={140} 
        placeholder="Send a message" 
      /> 
    </div>
  );
}
