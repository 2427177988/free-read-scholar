// src/utils/api.js
// --- 1. 定义后端服务器的基础 URL ---
const BACKEND_BASE_URL = 'https://my-ncbi-proxy-server-only.vercel.app'; // 你的后端服务器地址

// --- 2. 添加一个辅助函数用于处理请求和重试 ---
const fetchWithRetry = async (url, options = {}, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        console.warn(`Rate limited (429) for ${url}. Attempt ${i + 1}/${maxRetries + 1}. Retrying after delay...`);
        if (i < maxRetries) {
          // 计算延迟时间 (可选：实现指数退避)
          // const delay = baseDelay * Math.pow(2, i); // 指数退避: 1s, 2s, 4s, ...
          const delay = baseDelay; // 固定延迟，可以根据需要调整
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // 继续下一次循环，重新发起请求
        } else {
          // 即使是 429，也抛出错误，让调用者处理
          throw new Error(`Rate limit exceeded after ${maxRetries + 1} attempts. Status: ${response.status}`);
        }
      }

      if (!response.ok) {
        // 对于非 429 的错误，也抛出
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return response; // 请求成功，返回响应

    } catch (error) {
      console.error(`Fetch attempt ${i + 1} failed for ${url}:`, error);
      lastError = error;
      if (i === maxRetries) {
        // 所有重试都失败了
        console.error(`All ${maxRetries + 1} attempts failed for ${url}.`);
        throw lastError; // 抛出最后一次错误
      }
      // 对于非 429 的网络错误等，也可以考虑重试，但这里只处理 429
      // 如果需要对其他错误也重试，可以在这里添加逻辑
      // const delay = baseDelay * Math.pow(2, i); // 指数退避
      const delay = baseDelay; // 固定延迟
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// --- 3. 修改 fetchPapers 函数 ---
export const fetchPapers = async (searchTerm, db = 'pmc', retstart = 0, retmax = 10) => {
  // 确保数据库参数有效
  const validDb = db && ['pmc', 'pubmed'].includes(db) ? db : 'pmc';
  // 确保分页参数有效
  const validRetStart = Math.max(0, parseInt(retstart) || 0);
  const validRetMax = Math.max(1, Math.min(10000, parseInt(retmax) || 10)); // 限制 retmax 防止过大

  try {
    // 3.1. 调用后端的 search 路由，传递分页参数
    const searchUrl = `${BACKEND_BASE_URL}/api/search?term=${encodeURIComponent(searchTerm)}&db=${validDb}&retstart=${validRetStart}&retmax=${validRetMax}`;
    console.log(`Fetching search results from backend with pagination: ${searchUrl}`);
    // 使用 fetchWithRetry 替代直接的 fetch
    const searchResponse = await fetchWithRetry(searchUrl);
    // ... 其余 fetchPapers 逻辑保持不变 ...
    const searchJson = await searchResponse.json();

    // --- 解析后端返回的 { ids: [...], total: ... } 结构 ---
    const pageIds = searchJson.ids || [];
    const total = searchJson.total || 0;
    console.log(`Received total count from backend: ${total}`);
    console.log(`Received ${pageIds.length} IDs for the current page from backend`);

    if (pageIds.length === 0) {
      console.log("No IDs found for the current page from search.");
      return { papers: [], total: total };
    }

    // 3.2. 使用获取到的当前页 ID 列表调用后端的 papers 路由 (修改为 POST)
    const detailsUrl = `${BACKEND_BASE_URL}/api/papers`;
    console.log(`Fetching paper details from backend: ${detailsUrl}`);
    console.log(`Sending POST body:`, { ids: pageIds, db: validDb });

    // 使用 fetchWithRetry 替代直接的 fetch
    const detailsResponse = await fetchWithRetry(detailsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: pageIds,
        db: validDb
      })
    });

    // ... 其余 fetchPapers 逻辑保持不变 ...
    const result = await detailsResponse.json();
    console.log('JSON received from backend:', result);

    if (!result || !result.papers || !Array.isArray(result.papers)) {
      throw new Error('Backend response does not contain expected "papers" array.');
    }

    return {
      papers: result.papers,
      total: total
    };
  } catch (error) {
    console.error('Error in fetchPapers:', error);
    throw error; // 重新抛出错误，让调用者处理
  }
};

// --- 4. 修改 fetchPaperDetails 函数 ---
export const fetchPaperDetails = async (uid, db = 'pmc') => {
  // 确保数据库参数有效
  const validDb = db && ['pmc', 'pubmed'].includes(db) ? db : 'pmc';
  
  // uid 可能是 pmid 或 pmcid
  try {
    // 4.1. 调用后端的 paper/:id 路由
    const url = `${BACKEND_BASE_URL}/api/paper/${uid}?db=${validDb}`;
    console.log(`Fetching paper details from backend: ${url}`);
    // 使用 fetchWithRetry 替代直接的 fetch
    const response = await fetchWithRetry(url);
    // ... 其余 fetchPaperDetails 逻辑保持不变 ...
    const xmlText = await response.text();
    console.log('XML received from backend for single paper:', xmlText.substring(0, 200) + '...');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error('XML Parser Error:', parserError.textContent);
      throw new Error('Failed to parse XML response from backend.');
    }

    let pubmedArticle = xmlDoc.querySelector("article");
    let pmcId = '';
    let pmid = uid;
    let title = '';
    let abstract = '';
    let authors = [];
    let firstAuthor = 'Unknown';
    let journal = '';
    let pubDate = '';

    if (pubmedArticle) {
      console.log('Parsing PMC XML for single paper...');
      pmcId = pubmedArticle.querySelector("article-id[pub-id-type='pmc']")?.textContent || '';
      const articleIdList = pubmedArticle.querySelector("article-id[pub-id-type='pmid']");
      pmid = articleIdList ? articleIdList.textContent : uid;
      title = pubmedArticle.querySelector("article-title")?.textContent || '';
      const abstractElements = pubmedArticle.querySelectorAll("abstract p");
      if (abstractElements.length > 0) {
        abstract = Array.from(abstractElements).map(p => p.textContent).join(' ');
      } else {
        abstract = 'No abstract available.';
      }
      const authorElements = pubmedArticle.querySelectorAll("contrib[contrib-type='author'] name");
      authors = Array.from(authorElements).map(nameEl => {
        const firstName = nameEl.querySelector("given-names")?.textContent || '';
        const lastName = nameEl.querySelector("surname")?.textContent || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || nameEl.textContent.trim();
      }).filter(name => name && name !== 'null');
      firstAuthor = authors.length > 0 ? authors[0] : 'Unknown';
      journal = pubmedArticle.querySelector("journal-title")?.textContent || '';
      const pubDateElement = pubmedArticle.querySelector("pub-date");
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
    } else {
      pubmedArticle = xmlDoc.querySelector("PubmedArticle");
      if (pubmedArticle) {
        console.log('Parsing PubMed XML for single paper...');
        pmid = pubmedArticle.querySelector("PMID")?.textContent || uid;
        const articleIdList = pubmedArticle.querySelector("ArticleIdList");
        if (articleIdList) {
          const pmcIdElement = Array.from(articleIdList.querySelectorAll("ArticleId")).find(el => el.getAttribute('IdType') === 'pmc');
          pmcId = pmcIdElement ? pmcIdElement.textContent : '';
        }
        title = pubmedArticle.querySelector("ArticleTitle")?.textContent || '';
        const abstractElements = pubmedArticle.querySelectorAll("Abstract > AbstractText");
        if (abstractElements.length > 0) {
          abstract = Array.from(abstractElements).map(el => {
            const label = el.getAttribute('Label');
            const text = el.textContent.trim();
            return label ? `${label}: ${text}` : text;
          }).join(' ');
        } else {
          abstract = 'No abstract available.';
        }
        const authorList = pubmedArticle.querySelector("AuthorList");
        if (authorList) {
          const authorElements = Array.from(authorList.querySelectorAll("Author"));
          const rawAuthors = authorElements.map((authorEl, index) => {
            const firstName = authorEl.querySelector("ForeName")?.textContent || '';
            const lastName = authorEl.querySelector("LastName")?.textContent || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const authorName = fullName || authorEl.querySelector("CollectiveName")?.textContent || `Unknown${index}`;
            return { name: authorName, index };
          }).filter(item => item.name && item.name !== `Unknown${item.index}`);

          authors = rawAuthors.map(item => item.name);
          firstAuthor = authors.length > 0 ? authors[0] : 'Unknown';
        }
        journal = pubmedArticle.querySelector("MedlineTA")?.textContent || pubmedArticle.querySelector("Journal > Title")?.textContent || '';
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
            pubDate = pubmedArticle.querySelector("PubStatus > Year")?.textContent?.trim() || year;
          }
        }
      } else {
        console.error('Could not find <article> or <PubmedArticle> in single paper XML.');
        throw new Error('Could not parse paper details from XML.');
      }
    }

    return {
      pmcid: pmcId,
      uid: pmid,
      title: title.trim(),
      articletitle: abstract.trim(),
      sortfirstauthor: firstAuthor,
      authors: authors,
      source: journal.trim(),
      pubdate: pubDate,
    };
  } catch (error) {
    console.error('Error fetching paper details:', error);
    throw error; // 重新抛出错误，让调用者处理
  }
};