package project.backend.domain.chat.chatroom.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import java.util.Optional;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.entity.Member;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {

    Optional<ChatParticipant> findByParticipantAndChatRoom(Member member, ChatRoom chatRoom);

    //fixme chat_participant에 join_at 추가해서 가장 마지막에 참여한 채팅방을 반환하도록 변경
    @Query("""
        select cp.chatRoom.id 
        from ChatParticipant cp 
        where cp.participant.email = :email 
        order by cp.chatRoom.id desc 
        limit 1
        """)
    Optional<Long> findMostLargeRoomIdByEmail(@Param("email") String email);
}
