import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Typography, Spin, Alert, Divider, Space, Button } from 'antd';

const { Title, Text, Paragraph } = Typography;

const PaperDetailPage = () => {
  const { id } = useParams(); // e.g., '41452818'
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log("Fetching article for ID:", id); // 确认接收到的 ID

  useEffect(() => {
    const fetchPaperDetails = async () => {
      if (!id) {
        setError('No paper ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // --- 修改：处理 ID 格式 ---
        // 假设传入的 ID 是 PMID (例如 41452877)
        // 首先尝试从 PubMed 获取
        const pubmedId = id.trim();
        console.log("Using PubMed ID for API call:", pubmedId);

        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${encodeURIComponent(pubmedId)}&retmode=xml`;

        const response = await fetch(efetchUrl);
        if (!response.ok) {
            throw new Error(`Efetch failed: ${response.status} ${response.statusText}`);
        }
        const xmlText = await response.text();

        console.log("Efetch response XML (PubMed) for ID", pubmedId, ":", xmlText);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            throw new Error(`Error parsing XML response: ${parserError.textContent}`);
        }

        // 检查 PubMed 响应中的错误
        const errorElement = xmlDoc.querySelector("ERROR"); // 检查通用错误标签
        if (errorElement) {
            throw new Error(`API returned an error: ${errorElement.textContent}`);
        }

        // 查找 PubmedArticle
        const pubmedArticle = xmlDoc.querySelector("PubmedArticle");
        if (!pubmedArticle) {
            // 如果 PubMed 中找不到，再尝试 PMC (如果原始 ID 本身就是 PMCID)
            console.log("Article not found in PubMed. Trying PMC database...");
            const pmcId = pubmedId;
            const efetchUrlPMC = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${encodeURIComponent(pmcId)}&retmode=xml`;
            const responsePMC = await fetch(efetchUrlPMC);
            if (!responsePMC.ok) {
                throw new Error(`Efetch PMC failed: ${responsePMC.status} ${responsePMC.statusText}`);
            }
            const xmlTextPMC = await responsePMC.text();
            console.log("Efetch response XML (PMC) for ID", pmcId, ":", xmlTextPMC);

            const xmlDocPMC = parser.parseFromString(xmlTextPMC, "text/xml");
            const parserErrorPMC = xmlDocPMC.querySelector("parsererror");
            if (parserErrorPMC) {
                throw new Error(`Error parsing PMC XML response: ${parserErrorPMC.textContent}`);
            }

            const errorElementPMC = xmlDocPMC.querySelector("ERROR");
            if (errorElementPMC) {
                throw new Error(`PMC API returned an error: ${errorElementPMC.textContent}`);
            }

            const articlePMC = xmlDocPMC.querySelector("article");
            if (!articlePMC) {
                // 这就是我们之前看到的错误情况
                const errorMessagePMC = xmlDocPMC.querySelector("error")?.textContent || 'No article found in XML response.';
                throw new Error(errorMessagePMC);
            }

            // --- 从 PMC XML 解析论文详情 ---
            // ... (这里放之前的 PMC 解析逻辑) ...
            const pmcIdInXmlRaw = articlePMC.querySelector("article-id[pub-id-type='pmc']")?.textContent || '';
            // --- 修复：清理 PMC ID 以避免重复 ---
            const pmcIdParsed = pmcIdInXmlRaw.replace(/^(PMC|pmc)/i, '');
            console.log("原始PMC ID from XML:", pmcIdInXmlRaw, "清理后PMC ID:", pmcIdParsed); // 调试日志
            const uid = articlePMC.querySelector("article-id[pub-id-type='pmid']")?.textContent || '';
            const title = articlePMC.querySelector("article-title")?.textContent || '';
            const abstractElements = articlePMC.querySelectorAll("abstract p");
            let abstract = '';
            if (abstractElements.length > 0) {
                abstract = Array.from(abstractElements).map(p => p.textContent).join(' ');
            } else {
                abstract = 'No abstract available.';
            }
            const authorElements = articlePMC.querySelectorAll("contrib[contrib-type='author'] name");
            const authors = Array.from(authorElements).map(nameEl => {
                const firstName = nameEl.querySelector("given-names")?.textContent || '';
                const lastName = nameEl.querySelector("surname")?.textContent || '';
                const fullName = `${firstName} ${lastName}`.trim();
                return fullName || nameEl.textContent.trim();
            }).filter(name => name);
            const firstAuthor = authors.length > 0 ? authors[0] : 'Unknown';
            const journal = articlePMC.querySelector("journal-title")?.textContent || '';

            let pubDate = '';
            const pubDateElement = articlePMC.querySelector("pub-date");
            if (pubDateElement) {
              const year = pubDateElement.querySelector("year")?.textContent?.trim() || '';
              const month = pubDateElement.querySelector("month")?.textContent?.trim() || '';
              const day = pubDateElement.querySelector("day")?.textContent?.trim() || '';

              if (year && month && day) {
                pubDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              } else if (year && month) {
                pubDate = `${year}-${month.padStart(2, '0')}`;
              } else if (year) {
                pubDate = year;
              }
            }

            // --- 新增：查找 PMC XML 中的 PDF 链接 ---
            let pdfUrl = '';
            // 方法 1: 查找 <self-uri> 标签，通常指向 PDF
            const selfUri = articlePMC.querySelector("self-uri");
            if (selfUri) {
                const selfUriContent = selfUri.getAttribute('content-type');
                const selfUriHref = selfUri.getAttribute('xlink:href');
                if (selfUriContent && selfUriContent.toLowerCase().includes('pdf') && selfUriHref) {
                    // 如果是相对路径，需要拼接 PMC 基础 URL
                    pdfUrl = selfUriHref.startsWith('http') ? selfUriHref : `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcIdParsed}/${selfUriHref}`;
                }
            }

            // 方法 2: 查找 <ext-link> 标签，可能包含 PDF 链接 (类型可能不同)
            if (!pdfUrl) {
                const extLinks = articlePMC.querySelectorAll("ext-link");
                for (let link of extLinks) {
                    const extLinkType = link.getAttribute('ext-link-type');
                    const extLinkHref = link.getAttribute('xlink:href');
                    if (extLinkHref && extLinkHref.toLowerCase().endsWith('.pdf')) {
                         pdfUrl = extLinkHref;
                         break; // 找到一个就跳出
                    }
                }
            }

            // 方法 3: 根据 PMC ID 构造标准 PDF 链接 (备用方案，不一定总是有效)
            if (!pdfUrl && pmcIdParsed) {
                pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcIdParsed}/pdf/`;
                console.log("Constructed PDF URL:", pdfUrl); // 调试日志
            }
            // --- 结束新增 ---

            const paperData = {
              pmcid: pmcIdParsed, // 使用清理后的 ID
              uid: uid,
              title: title.trim(),
              articletitle: abstract.trim(),
              sortfirstauthor: firstAuthor,
              authors: authors.join(', '),
              source: journal.trim(),
              pubdate: pubDate,
              pdfUrl: pdfUrl, // 添加 PDF 链接
            };
            setPaper(paperData);
            console.log("Fetched paper details from PMC:", paperData);
            return; // 成功获取，退出
        }

        // --- 从 PubMed XML 解析论文详情 ---
        // 注意：PubMed XML 结构与 PMC 不同
        const pmid = pubmedArticle.querySelector("PMID")?.textContent || '';
        const articleTitle = pubmedArticle.querySelector("ArticleTitle")?.textContent || '';
        // 获取摘要
        const abstractElements = pubmedArticle.querySelectorAll("Abstract > AbstractText");
        let abstract = '';
        if (abstractElements.length > 0) {
            // AbstractText 可能有多个，或者包含属性 (如 Label)
            abstract = Array.from(abstractElements).map(el => {
                // 检查是否有 Label 属性
                const label = el.getAttribute('Label');
                const text = el.textContent.trim();
                return label ? `${label}: ${text}` : text;
            }).join(' ');
        } else {
            abstract = 'No abstract available.';
        }

        // 获取作者列表
        const authorList = pubmedArticle.querySelector("AuthorList");
        let authors = [];
        let firstAuthor = 'Unknown';
        if (authorList) {
            const authorElements = authorList.querySelectorAll("Author");
            authors = Array.from(authorElements).map(authorEl => {
                const firstName = authorEl.querySelector("ForeName")?.textContent || '';
                const lastName = authorEl.querySelector("LastName")?.textContent || '';
                const fullName = `${firstName} ${lastName}`.trim();
                return fullName || authorEl.querySelector("CollectiveName")?.textContent || 'Unknown';
            }).filter(name => name && name !== 'Unknown');
            firstAuthor = authors.length > 0 ? authors[0] : 'Unknown';
        }

        const journal = pubmedArticle.querySelector("MedlineTA")?.textContent || pubmedArticle.querySelector("Journal > Title")?.textContent || '';

        // 获取发表日期
        let pubDate = '';
        const pubDateElement = pubmedArticle.querySelector("PubDate");
        if (pubDateElement) {
          const year = pubDateElement.querySelector("Year")?.textContent?.trim() || '';
          const month = pubDateElement.querySelector("Month")?.textContent?.trim() || '';
          const day = pubDateElement.querySelector("Day")?.textContent?.trim() || '';

          if (year && month && day) {
            pubDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else if (year && month) {
            pubDate = `${year}-${month.padStart(2, '0')}`;
          } else if (year) {
            pubDate = year;
          } else {
            // 尝试 PubStatus 中的年份
            pubDate = pubmedArticle.querySelector("PubStatus > Year")?.textContent?.trim() || year;
          }
        }

        // 检查是否有 PMCID
        const articleIdList = pubmedArticle.querySelector("ArticleIdList");
        let pmcIdRaw = '';
        if (articleIdList) {
            const pmcIdElement = Array.from(articleIdList.querySelectorAll("ArticleId")).find(el => el.getAttribute('IdType') === 'pmc');
            pmcIdRaw = pmcIdElement ? pmcIdElement.textContent : '';
        }
        
        // --- 修复：清理 PMC ID 以避免重复 ---
        const pmcId = pmcIdRaw.replace(/^(PMC|pmc)/i, '');
        console.log("原始PMC ID from PubMed XML:", pmcIdRaw, "清理后PMC ID:", pmcId); // 调试日志

        // --- 新增：尝试从 PubMed XML 中查找 PDF 链接 ---
        // PubMed XML 本身通常不直接包含 PDF 链接，但如果有 LinkOut 数据或其他扩展信息，可能需要额外 API 调用。
        // 这里我们尝试查找可能的外部链接或使用 PMC ID 构造链接。
        let pdfUrl = '';
        if (pmcId) {
            // 如果有 PMCID，尝试构造 PMC 的 PDF 链接 - 使用清理后的 ID
            pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/pdf/`;
            console.log("Constructed PDF URL from PubMed:", pdfUrl); // 调试日志
        }
        // 注意：PubMed XML 中直接查找 PDF 链接比较困难，通常需要 LinkOut API 或其他服务。
        // 这里我们只处理已知 PMCID 的情况。
        // --- 结束新增 ---

        const paperData = {
          pmcid: pmcId, // PubMed 中的 PMCID - 使用清理后的 ID
          uid: pmid, // PubMed ID
          title: articleTitle.trim(),
          articletitle: abstract.trim(),
          sortfirstauthor: firstAuthor,
          authors: authors.join(', '),
          source: journal.trim(),
          pubdate: pubDate,
          pdfUrl: pdfUrl, // 添加 PDF 链接，可能为空
        };
        // --- 结束解析 ---

        setPaper(paperData);
        console.log("Fetched paper details from PubMed:", paperData);

      } catch (err) {
        console.error("Error fetching paper details:", err);
        setError(err.message || 'An error occurred while fetching paper details.');
        setPaper(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPaperDetails();
  }, [id]); // 依赖于 id

  if (loading) {
    return (
      <div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}>
        <Spin tip="Loading paper details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message="Error" description={error} type="error" showIcon />
      </div>
    );
  }

  if (!paper) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message="No Paper Found" description={`Could not find a paper with ID: ${id}`} type="warning" showIcon />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>{paper.title}</Title>
      <Card>
        <Space size="large" direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Authors: </Text>
            <Text>{paper.authors || paper.sortfirstauthor}</Text>
          </div>
          <div>
            <Text strong>Journal: </Text>
            <Text>{paper.source}</Text>
          </div>
          <div>
            <Text strong>Publication Date: </Text>
            <Text>{paper.pubdate}</Text>
          </div>
          <div>
            <Text strong>PMCID: </Text>
            <Text code>{paper.pmcid || 'N/A'}</Text> {/* 显示 PMCID 或 N/A */}
          </div>
          <div>
            <Text strong>PMID: </Text>
            <Text code>{paper.uid}</Text>
          </div>
          {/* --- 新增：PDF 下载链接 --- */}
          <div>
            <Text strong>PDF: </Text>
            {paper.pdfUrl && paper.pdfUrl !== '' ? (
              <Button type="primary" href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
                Download PDF (PMC)
              </Button>
            ) : (
              <Text type="secondary">PDF link not available (only available for open-access papers in PMC).</Text>
            )}
          </div>
          {/* --- 结束新增 --- */}
          <Divider />
          <div>
            <Title level={4}>Abstract</Title>
            <Paragraph>{paper.articletitle}</Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default PaperDetailPage;