package project.backend.domain.chat.chatroom.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {

}
