package project.backend.domain.chat.chatroom.api;

import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.RecentChatRoomResponse;

@Controller
@RequiredArgsConstructor
public class ChatRoomController {

    private final ChatRoomService chatRoomService;

    @GetMapping("/chat-rooms/recent")
    public RecentChatRoomResponse getRecentRoomId(Principal principal) {
        Long roomId = chatRoomService.getMostRecentRoomId(principal.getName());
        return new RecentChatRoomResponse(roomId);
    }

}
