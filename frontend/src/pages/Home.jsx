import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../components/api/axiosInstance';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController(); // AbortController 사용

    axiosInstance.get('/recent', {
      signal: controller.signal // 요청 취소 시그널 추가
    })
      .then(res => {
        const { roomId, inviteCode } = res.data;
        if (roomId) {
          navigate(`/chat/${roomId}/${inviteCode}`);
        } else {
          console.warn('roomId 없음');
          navigate('/blank');
        }
      })
      .catch(err => {
        // 요청이 취소된 경우는 무시
        if (err.name === 'AbortError' || err.name === 'CanceledError') {
          return;
        }
        
        const status = err.response?.status;
        if (status === 404) {
          navigate('/blank');
        } else {
          console.error('오류:', err);
          alert('서버 오류로 채팅방 이동 실패');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // 컴포넌트 언마운트 시 요청 취소
    return () => {
      controller.abort();
    };
  }, [navigate]);

  if (loading) {
    return <div>가장 최근 채팅방으로 이동 중...</div>;
  }

  return null; // 로딩이 끝나면 이미 다른 페이지로 이동했으므로
};

export default Home;