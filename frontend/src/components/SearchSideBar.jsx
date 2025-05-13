import React from 'react';
import 'highlight.js/styles/github.css';

const SearchSidebar = ({ 
  searchKeyword, 
  searchResults, 
  isSearching, 
  currentPage, 
  totalPages,
  totalElements,
  onClose, 
  onPageChange 
}) => {
  return (
    <div style={{ 
      width: '280px',
      marginLeft: '20px',
      backgroundColor: '#fff',
      padding: '15px',
      borderRadius: '8px',
      overflowY: 'auto',
      boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '15px', 
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

      {isSearching ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>검색 중...</div>
      ) : totalElements === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>검색 결과가 없습니다.</div>
      ) : (
        <>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
            최신순으로 정렬됨 • 전체 {totalElements}개의 결과
          </div>

          {searchResults.map((msg, index) => (
            <div key={index} style={{ 
              marginBottom: '15px', 
              padding: '10px', 
              backgroundColor: '#f8f8f8', 
              borderRadius: '5px',
              border: '1px solid #eee'
            }}>
              <div style={{ display: 'flex' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#7ec8e3',
                  marginRight: '10px',
                  flexShrink: 0
                }} />
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#333' }}>{msg.senderName}</strong>
                    <span style={{ fontSize: '11px', color: '#888' }}>
                      {new Date(msg.sendAt).toLocaleString('ko-KR', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '5px', color: '#333' }}>
                    {msg.type === 'CODE' || msg.content.startsWith('```') ? (
                      <div style={{ backgroundColor: '#f1f3f4', padding: '6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                        <code style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                          {msg.content.replace(/```/g, '')}
                        </code>
                      </div>
                    ) : (
                      <div>{msg.content}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 0}
                style={{ 
                  margin: '0 5px', 
                  padding: '5px 10px', 
                  cursor: currentPage === 0 ? 'default' : 'pointer', 
                  opacity: currentPage === 0 ? 0.5 : 1,
                  border: '1px solid #ccc',
                  borderRadius: '3px',
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
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                style={{ 
                  margin: '0 5px', 
                  padding: '5px 10px', 
                  cursor: currentPage === totalPages - 1 ? 'default' : 'pointer', 
                  opacity: currentPage === totalPages - 1 ? 0.5 : 1,
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: 'white'
                }}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchSidebar;
