package project.backend.domain.chat.chatroom.api;

<<<<<<< HEAD
import java.security.Principal;

=======
import jakarta.validation.Valid;
>>>>>>> dev
import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomSimpleResponse;
import project.backend.domain.chat.chatroom.dto.InviteCodeResponse;
import project.backend.domain.chat.chatroom.dto.InviteJoinRequest;
import project.backend.domain.chat.chatroom.dto.InviteJoinResponse;
import java.security.Principal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
<<<<<<< HEAD
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.dto.MyChatRoomResponse;
=======
import project.backend.domain.chat.chatroom.dto.ChatRoomDetailResponse;
>>>>>>> dev
import project.backend.domain.chat.chatroom.dto.RecentChatRoomResponse;
import project.backend.domain.member.dto.MemberDetails;
import project.backend.global.exception.errorcode.AuthErrorCode;
import project.backend.global.exception.ex.AuthException;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/chat-rooms")
public class ChatRoomController {

    private final ChatRoomService chatRoomService;

<<<<<<< HEAD
    @GetMapping("/chat-rooms/recent")
    public RecentChatRoomResponse getRecentRoomId(Principal principal) {
        Long roomId = chatRoomService.getMostRecentRoomId(principal.getName());
        return new RecentChatRoomResponse(roomId);
    }

    @GetMapping("/chat-rooms") // URL 매핑 -> 추후 인증객체 id로 조회 예정
    public Page<ChatRoomResponse> findAllChatRooms(@PathVariable Long memberId,
                                                   @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        log.info("chatRoom 조회 요청 들어옴: memberId = " + memberId);
        // 채팅방 목록 리스트로 가져오기
        return chatRoomService.findAllByMemberId(memberId, pageable);
    }

    @GetMapping("/chat-rooms/mine/{memberId}")
    public Page<MyChatRoomResponse> findMyAllChatRooms(@PathVariable Long memberId,
                                                       @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        log.info("자신이 만든 채팅방 요청: memberId = {}", memberId);
        return chatRoomService.findAllRoomsByOwnerId(memberId, pageable);

    }
=======
	@PostMapping
	@ResponseBody
	@ResponseStatus(HttpStatus.CREATED)
	public ChatRoomSimpleResponse createChatRoom(@Valid @RequestBody ChatRoomRequest request,
		@AuthenticationPrincipal MemberDetails memberDetails) {
		Long ownerId = memberDetails.getId();

		log.info("채팅방생성");
		return chatRoomService.createChatRoom(request, ownerId);
	}

	@GetMapping("/invite/{roomId}")
	@ResponseBody
	public InviteCodeResponse getInviteUrl(@PathVariable Long roomId,
		@AuthenticationPrincipal MemberDetails memberDetails
	) {

		if (memberDetails == null) {
			throw new AuthException(AuthErrorCode.UNAUTHORIZED_USER);
		}

		Long memberId = memberDetails.getId();
		boolean isParticipant = chatRoomService.isParticipant(roomId, memberId);

		if (!isParticipant) {
			throw new AuthException(AuthErrorCode.FORBIDDEN_PARTICIPANT);
		}

		String inviteCode = chatRoomService.getInviteCode(roomId);

		return new InviteCodeResponse(inviteCode);
	}


	@PostMapping("/join")
	@ResponseStatus(HttpStatus.OK)
	public InviteJoinResponse joinChatRoom(@RequestBody InviteJoinRequest request,
		@AuthenticationPrincipal MemberDetails memberDetails
	) {
		if (memberDetails == null) {
			throw new AuthException(AuthErrorCode.UNAUTHORIZED_USER);
		}

		Long roomId = chatRoomService.joinChatRoom(request.getInviteCode(), memberDetails.getId());
		return new InviteJoinResponse(roomId);
	}


	@GetMapping("/recent")
	public RecentChatRoomResponse getRecentRoomId(Principal principal) {
		Long roomId = chatRoomService.getMostRecentRoomId(principal.getName());
		return new RecentChatRoomResponse(roomId);
	}

	@GetMapping // URL 매핑 -> 추후 인증객체 id로 조회 예정
	public Page<ChatRoomDetailResponse> findAllChatRooms(@PathVariable Long memberId,
		@PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
		log.info("chatRoom 조회 요청 들어옴: memberId = " + memberId);
		// 채팅방 목록 리스트로 가져오기
		return chatRoomService.findAllByMemberId(memberId, pageable);
	}
>>>>>>> dev


}
