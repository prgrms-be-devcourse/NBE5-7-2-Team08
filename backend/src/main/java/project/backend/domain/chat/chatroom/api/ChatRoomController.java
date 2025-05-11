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
    public ResponseEntity<RecentChatRoomResponse> getRecentRoomId(Principal principal) {
        return chatRoomService.getMostRecentRoomId(principal.getName())
            .map(roomId -> ResponseEntity.ok(new RecentChatRoomResponse(roomId)))
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

}
