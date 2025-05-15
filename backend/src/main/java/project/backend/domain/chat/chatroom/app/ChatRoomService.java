package project.backend.domain.chat.chatroom.app;


import java.util.Optional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomSimpleResponse;
import project.backend.domain.chat.chatroom.dto.MyChatRoomResponse;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatroom.dto.ChatRoomDetailResponse;
import project.backend.domain.chat.chatroom.mapper.ChatRoomMapper;
import project.backend.global.exception.errorcode.MemberErrorCode;
import project.backend.global.exception.ex.ChatRoomException;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.ex.MemberException;

@Slf4j
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ChatRoomService {

    private final MemberService memberService;
    private final ChatRoomRepository chatRoomRepository;
    private final MemberRepository memberRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatParticipantRepository chatParticipantRepository;
    private final ChatRoomMapper chatRoomMapper;

    @Transactional
    public ChatRoomSimpleResponse createChatRoom(ChatRoomRequest request, Long ownerId) {
        Member owner = memberRepository.findById(ownerId)
                .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

        ChatRoom chatRoom = chatRoomMapper.toEntity(request, owner);

        ChatRoom savedRoom = chatRoomRepository.save(chatRoom);

        ChatParticipant chatParticipant = ChatParticipant.of(owner, chatRoom);

        chatParticipantRepository.save(chatParticipant);

        return chatRoomMapper.toSimpleResponse(savedRoom);
    }

    @Transactional(readOnly = true)
    public String getInviteCode(Long roomId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

        return room.getInviteCode();
    }

    @Transactional(readOnly = true)
    public boolean isParticipant(Long roomId, Long memberId) {
        return chatParticipantRepository.existsByParticipantIdAndChatRoomId(memberId, roomId);
    }


    @Transactional
    public Long joinChatRoom(String inviteCode, Long memberId) {
        ChatRoom room = chatRoomRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_CODE_NOT_FOUND));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

        boolean isAlreadyParticipant = chatParticipantRepository
                .existsByParticipantIdAndChatRoomId(memberId, room.getId());

        if (isAlreadyParticipant) {
            throw new ChatRoomException(ChatRoomErrorCode.ALREADY_PARTICIPANT);
        }

        ChatParticipant chatParticipant = ChatParticipant.of(member, room);

        chatParticipantRepository.save(chatParticipant);

        return room.getId();
    }


    public Long getMostRecentRoomId(String email) {

        // 1순위: 가장 최근 메시지가 도착한 채팅방
        Optional<Long> recentRoomId = chatMessageRepository.findMostRecentRoomIdByMemberEmail(
                email);
        if (recentRoomId.isPresent()) {
            return recentRoomId.get();
        }

        // 2순위: 채팅방에 메세지가 없을 때 참여중인 채팅방 중 roomId가 가장 큰 채팅방
        Optional<Long> fallbackRoomId = chatParticipantRepository.findMostLargeRoomIdByEmail(email);
        if (fallbackRoomId.isPresent()) {
            return fallbackRoomId.get();
        }

        // 아무 채팅방에도 참여한 적이 없음 → 예외 던지기
        throw new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_EXIST);

    }

    public Page<MyChatRoomResponse> findAllRoomsByOwnerId(Long memberId, Pageable pageable) {

        Page<ChatRoom> allRoomsByOwnerId = chatRoomRepository.findAllRoomsByOwnerId(memberId, pageable);

        log.info("allRoomsByOwnerId = {}", allRoomsByOwnerId);
        return allRoomsByOwnerId.map(ChatRoomMapper::toProfileResponse);
    }


    @Transactional(readOnly = true)
    public Page<ChatRoomDetailResponse> findChatRoomsByParticipantId(Long memberId,
                                                                     Pageable pageable) {

        Page<ChatRoom> chatRooms = chatRoomRepository.findByParticipants_Participant_Id(memberId,
                pageable);

        if (chatRooms.isEmpty()) {
            throw new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND);
        }

        return chatRooms.map(ChatRoomMapper::toDetailResponse);
    }


}

