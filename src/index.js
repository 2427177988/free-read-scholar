// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client'; // 确保从 react-dom/client 导入
import './index.css'; // 确保这个文件存在或这行被注释/删除
import App from './App'; // 确保 App 文件路径和扩展名正确

// 使用新的 createRoot API
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals