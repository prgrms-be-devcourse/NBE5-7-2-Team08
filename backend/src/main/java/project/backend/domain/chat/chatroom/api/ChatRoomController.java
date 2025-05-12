package project.backend.domain.chat.chatroom.api;

import java.security.Principal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.dto.RecentChatRoomResponse;

@Slf4j
@RestController
@RequiredArgsConstructor
public class ChatRoomController {

	private final ChatRoomService chatRoomService;

	@GetMapping("/chat-rooms/recent")
	public RecentChatRoomResponse getRecentRoomId(Principal principal) {
		Long roomId = chatRoomService.getMostRecentRoomId(principal.getName());
		return new RecentChatRoomResponse(roomId);
	}

	@GetMapping("/chatRooms") // URL 매핑 -> 추후 인증객체 id로 조회 예정
	public Page<ChatRoomResponse> findAllChatRooms(@RequestParam Long memberId,
		@PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
		log.info("chatRoom 조회 요청 들어옴: memberId = " + memberId);
		// 채팅방 목록 리스트로 가져오기
		return chatRoomService.findAllByMemberId(memberId, pageable);
	}

}
