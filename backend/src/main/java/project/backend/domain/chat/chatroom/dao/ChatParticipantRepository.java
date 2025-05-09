package project.backend.domain.chat.chatroom.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import java.util.Optional;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.entity.Member;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {

    Optional<ChatParticipant> findByParticipantAndChatRoom(Member member, ChatRoom chatRoom);

}
