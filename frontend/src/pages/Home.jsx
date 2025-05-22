import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../components/api/axiosInstance';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const alertShownRef = useRef(false);  // ProfilePage와 동일한 패턴
  const stopRequestRef = useRef(false); // ProfilePage와 동일한 패턴

  useEffect(() => {
    if (stopRequestRef.current) return; // 이미 에러가 발생했으면 실행하지 않음

    const fetchRecentRoom = async () => {
      try {
        const res = await axiosInstance.get('/chat-rooms/recent');
        
        if (stopRequestRef.current) return; // 요청 중간에 취소되었는지 확인
        
        const { roomId, inviteCode } = res.data;
        if (roomId) {
          navigate(`/chat/${roomId}/${inviteCode}`);
        } else {
          console.warn('roomId 없음');
          navigate('/blank');
        }
      } catch (err) {
        if (!alertShownRef.current && !stopRequestRef.current) {
          alertShownRef.current = true;
          stopRequestRef.current = true; // 추가 요청 방지
          
          const status = err.response?.status;
          if (status === 404) {
            navigate('/blank');
          } else {
            console.error('오류:', err);
            alert('서버 오류로 채팅방 이동 실패');
          }
        }
      } finally {
        if (!stopRequestRef.current) {
          setLoading(false);
        }
      }
    };

    fetchRecentRoom();

    // 클린업 함수
    return () => {
      stopRequestRef.current = true;
    };
  }, [navigate]);

  if (loading) {
    return <div>가장 최근 채팅방으로 이동 중...</div>;
  }

  return null;
};

export default Home;