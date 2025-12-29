import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 使用 useNavigate 替代 history
import { Input, Button, Card, Row, Col, Typography } from 'antd';
const { Title, Paragraph } = Typography;

const HomePage = () => {
    const [query, setQuery] = useState('');
    const navigate = useNavigate(); // 使用 hook 获取 navigate 函数

    const handleSearch = () => {
        // 使用 navigate 替代 history.push
        navigate(`/search?q=${encodeURIComponent(query)}`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <Title level={2}>Welcome to FreeRead Scholar</Title>
            <Paragraph>Search, click, and read free academic papers.</Paragraph>
            <Row gutter={[16, 16]}>
                <Col span={16}>
                    <Input
                        placeholder="Enter keywords..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)} // 确保使用正确的箭头函数语法 =>
                        onPressEnter={handleSearch}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col span={8}>
                    <Button type="primary" onClick={handleSearch} block>
                        Search
                    </Button>
                </Col>
            </Row>
            <Card title="Popular Resources" style={{ marginTop: '20px' }}>
                <Row gutter={[16, 16]}>
                    <Col span={8}>
                        <a href="/search?q=source%3Apmc" target="_self">PubMed Central (PMC)</a>
                    </Col>
                    <Col span={8}>
                        <a href="/search?q=source%3Aarxiv" target="_self">arXiv</a>
                    </Col>
                    <Col span={8}>
                        <a href="/search?q=source%3Adoaj" target="_self">DOAJ</a>
                    </Col>
                </Row>
            </Card>
        </div>
    );
};

export default HomePage;