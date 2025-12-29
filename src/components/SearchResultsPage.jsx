import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Typography, Input, Button, Space, Empty, Spin, message, Pagination } from 'antd';
import { fetchPapers } from '../utils/api'; // 确保你的 fetchPapers 函数能接收 retstart 和 retmax 参数

const { Title, Text, Paragraph } = Typography;

const SearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 从URL参数获取初始查询
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const q = searchParams.get('q');
    if (q) {
      const decodedQuery = decodeURIComponent(q);
      setQuery(decodedQuery);
      // 注意：这里不直接调用 handleSearch，而是设置好 query 状态，
      // 让后续的 navigate 或用户操作触发搜索，或者在这里调用也行，取决于你想如何初始化
      // 如果在这里调用，请确保 fetchPapers 能处理好初始加载逻辑
      handleSearch(decodedQuery);
    }
  }, [location.search]);

  // 修改后的搜索函数，仅获取第一页数据
  const handleSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) {
      message.warning('Please enter a search query.');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchPerformed(true);
    // 搜索时重置为第一页
    setCurrent(1);

    try {
      console.log("Searching for:", searchQuery);
      // 调用 API 获取第一页数据
      // 注意：retstart = (current_page - 1) * page_size = (1 - 1) * pageSize = 0
      const data = await fetchPapers(searchQuery, 0, pageSize);
      console.log("API Response for search:", data);

      // 假设API返回格式为 { papers: [...], total: number }
      const papers = Array.isArray(data) ? data : (data.papers || []);
      // 从 API 响应中获取总数
      const totalResults = data.total || papers.length; // 如果API没有返回total，可以先用数组长度代替，但最好API返回

      setResults(papers);
      setTotal(totalResults);

      if (papers.length === 0) {
        if (/[^\x00-\x7F]/.test(searchQuery)) {
          message.info('No results found for the Chinese query. Try using English keywords for better results.');
        } else {
          message.info('No results found for the query.');
        }
      }
    } catch (err) {
      console.error("Error fetching search results:", err);
      setError(err.message || 'An error occurred while fetching results.');
      message.error('Failed to fetch search results.');
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // 修改后的分页处理函数，每次切换页面都调用 API
  const handlePageChange = async (page, size) => {
    setLoading(true);
    setError(null);

    // 计算新的 retstart
    const newRetstart = (page - 1) * (size || pageSize); // 如果 size 未定义，则使用当前 pageSize
    const newPageSize = size || pageSize;

    try {
      console.log("Fetching page:", page, "with retstart:", newRetstart, "and retmax:", newPageSize);
      // 调用 API 获取当前页数据
      const data = await fetchPapers(query, newRetstart, newPageSize);
      console.log("API Response for page change:", data);

      const papers = Array.isArray(data) ? data : (data.papers || []);
      const totalResults = data.total || papers.length; // 从 API 响应中获取总数

      setResults(papers);
      setTotal(totalResults);
      setCurrent(page);
      if (size) {
        setPageSize(newPageSize);
      }
    } catch (err) {
      console.error("Error fetching page results:", err);
      setError(err.message || 'An error occurred while fetching page results.');
      message.error('Failed to fetch page results.');
      // 保持当前页不变，或者可以重置回第一页
      // setCurrent(current); // 或者 setCurrent(1);
      setResults([]); // 清空结果
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
  };

  const handleInputSearch = (value) => {
    setQuery(value);
    // 更新URL参数
    navigate(`/search?q=${encodeURIComponent(value)}`);
    handleSearch(value);
  };

  // Helper function to get a valid ID for the paper detail route
  const getValidId = (item) => {
    // Prefer PMC ID, fallback to UID (e.g., PMID)
    // Ensure the ID is not empty
    if (item.pmcid && item.pmcid.trim() !== '') {
      return item.pmcid.trim();
    }
    if (item.uid && item.uid.trim() !== '') {
      return item.uid.trim();
    }
    return null; // Return null if no valid ID is found
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Search Results</Title>
      <Space style={{ marginBottom: 20, width: '100%' }} vertical>
        <Input.Search
          placeholder="Enter search query (English recommended)..."
          value={query}
          onChange={handleInputChange}
          onSearch={handleInputSearch}
          enterButton="Search"
          loading={loading}
        />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Tip: For best results, use English keywords.
        </Text>
      </Space>

      {error && (
        <div style={{ color: 'red', marginBottom: 16 }}>
          <Text type="danger">Error: {error}</Text>
        </div>
      )}

      <Spin spinning={loading}>
        <Space size="large" vertical style={{ width: '100%' }}>
          {results.length === 0 && !loading && !error && searchPerformed && (
            <Empty description="No results found for the query." />
          )}

          {results.map((item) => {
            const validId = getValidId(item);
            return (
              <Card
                key={validId || item.uid || item.pmcid || 'unknown'}
                title={
                  validId ? (
                    <a href={`/paper/${validId}`}>
                      {item.title || 'No Title'}
                    </a>
                  ) : (
                    <>{item.title || 'No Title'}</> // Plain text if no ID
                  )
                }
                extra={
                  validId ? (
                    <Button type="link" size="small">
                      <a href={`/paper/${validId}`}>Read More</a>
                    </Button>
                  ) : (
                    <Button type="link" size="small" disabled>Read More</Button>
                  )
                }
                style={{ width: '100%' }}
              >
                <Space size="small" separator={<span>|</span>} wrap>
                  <Text type="secondary">Author: {item.sortfirstauthor || 'Unknown'}</Text>
                  <Text type="secondary">Source: {item.source || 'Unknown'}</Text>
                  <Text type="secondary">Date: {item.pubdate || 'Unknown'}</Text>
                </Space>
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                  {item.articletitle || 'No abstract available.'}
                </Paragraph>
              </Card>
            );
          })}
        </Space>

        {/* 分页组件 */}
        {total > 0 && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Pagination
              current={current}
              pageSize={pageSize}
              total={total}
              onChange={handlePageChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} items`}
            />
          </div>
        )}
      </Spin>
    </div>
  );
};

export default SearchResultsPage;