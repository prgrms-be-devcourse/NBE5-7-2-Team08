package project.backend.domain.chat.chatmessage.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

}
