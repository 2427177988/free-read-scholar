import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'; // 1. 更改导入
import { Layout } from 'antd';
import HomePage from './components/HomePage';
import SearchResultsPage from './components/SearchResultsPage';
import PaperDetailPage from './components/PaperDetailPage';

const { Header, Content, Footer } = Layout;

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ color: '#fff' }}>
          <h1 style={{ color: '#fff', margin: 0 }}>FreeRead Scholar</h1>
        </Header>
        <Content style={{ padding: '20px', background: '#f0f2f5' }}>
          {/* 2. 将 Switch 替换为 Routes */}
          <Routes>
            {/* 3. 将 component 改为 element */}
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/paper/:id" element={<PaperDetailPage />} />
          </Routes>
        </Content>
        <Footer style={{ textAlign: 'center', background: '#f0f2f5' }}>
          FreeRead Scholar - Access Free Academic Papers
        </Footer>
      </Layout>
    </Router>
  );
}

export default App;