import React from 'react';
import 'highlight.js/styles/github.css';

const SearchSidebar = ({ 
  searchKeyword,
  searchResults,
  isSearching,
  errorMessage,
  currentPage,
  totalPages,
  totalElements,
  onClose,
  onPageChange
}) => {
  // 페이지당 10개씩 표시
  const itemsPerPage = 10;
  
  // 총 페이지 수 계산 (10개씩 끊어서)
  const calculatedTotalPages = Math.ceil(totalElements / itemsPerPage);
  
  return (
    <div className="search-sidebar" style={{ 
      width: '350px', // 더 넓게 수정
      marginLeft: '20px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%' // 전체 높이 사용
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '15px',
        borderBottom: '1px solid #eee', 
        paddingBottom: '10px' 
      }}>
        <h3 style={{ margin: 0 }}>"{searchKeyword}" 검색 결과</h3>
        <button 
          onClick={onClose}
          style={{ 
            padding: '5px 10px', 
            backgroundColor: '#f0f0f0', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          닫기
        </button>
      </div>

      <div style={{ 
        fontSize: '14px', 
        color: '#666', 
        padding: '10px 15px 5px',
        borderBottom: '1px solid #f0f0f0'
      }}>
        최신순으로 정렬됨 • 전체 {totalElements}개의 결과
      </div>

      <div style={{ 
        overflowY: 'auto', 
        flex: 1,
        padding: '0 15px' 
      }}>
      {isSearching ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>검색 중...</div>
      ) : errorMessage ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: '#d93025', 
          backgroundColor: '#fce8e6', 
          borderRadius: '4px',
          border: '1px solid #f7c6c5',
          margin: '15px 0'
        }}>
          {errorMessage}
        </div>
      ) : totalElements === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>검색 결과가 없습니다.</div>
      ) : (
        <>
          {searchResults.map((msg, index) => (
            <div key={index} style={{ 
              marginBottom: '15px', 
              padding: '15px', // 패딩 증가
              backgroundColor: '#f8f8f8', 
              borderRadius: '5px',
              border: '1px solid #eee'
            }}>
              <div style={{ display: 'flex' }}>
                <div style={{
                  width: '40px', // 크기 증가
                  height: '40px', // 크기 증가
                  borderRadius: '50%',
                  backgroundColor: '#7ec8e3',
                  marginRight: '12px',
                  flexShrink: 0
                }} />
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ fontSize: '16px', color: '#333' }}>{msg.senderName}</strong>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {new Date(msg.sendAt).toLocaleString('ko-KR', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    marginTop: '8px', 
                    color: '#333',
                    maxHeight: '200px', // 최대 높이 제한
                    overflowY: 'auto' // 내용이 많으면 스크롤
                  }}>
                    {msg.type === 'CODE' || (msg.content && msg.content.startsWith('```')) ? (
                      <div style={{ 
                        backgroundColor: '#f1f3f4', 
                        padding: '10px', 
                        borderRadius: '4px', 
                        fontFamily: 'monospace',
                        maxHeight: '180px',
                        overflowY: 'auto'
                      }}>
                        <code style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                          {msg.content ? msg.content.replace(/```/g, '') : ''}
                        </code>
                      </div>
                    ) : (
                      <div style={{ lineHeight: '1.5' }}>{msg.content}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      </div>

      {calculatedTotalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          padding: '15px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            style={{ 
              margin: '0 5px', 
              padding: '8px 15px',
              cursor: currentPage === 0 ? 'default' : 'pointer', 
              opacity: currentPage === 0 ? 0.5 : 1,
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
          >
            이전
          </button>
          <span style={{ 
            margin: '0 10px', 
            display: 'flex', 
            alignItems: 'center',
            fontSize: '14px'
          }}>
            {currentPage + 1} / {calculatedTotalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === calculatedTotalPages - 1}
            style={{ 
              margin: '0 5px', 
              padding: '8px 15px',
              cursor: currentPage === calculatedTotalPages - 1 ? 'default' : 'pointer', 
              opacity: currentPage === calculatedTotalPages - 1 ? 0.5 : 1,
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchSidebar;
