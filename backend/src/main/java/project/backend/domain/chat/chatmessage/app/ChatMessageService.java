package project.backend.domain.chat.chatmessage.app;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;

@Service
@RequiredArgsConstructor
public class ChatMessageService {

    public void save(Long roomId, ChatMessageRequest request, String email) {

    }
}
