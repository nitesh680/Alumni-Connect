import { FormControl } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { Box, Text } from "@chakra-ui/layout";
import "./styles.css";
import { IconButton, Spinner, useToast, Button } from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowBackIcon } from "@chakra-ui/icons";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";

import io from "socket.io-client";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import { ChatState } from "../Context/ChatProvider";
const ENDPOINT = process.env.REACT_APP_API_URL || "http://localhost:5000";
var socket, selectedChatCompare;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [istyping, setIsTyping] = useState(false);
  const toast = useToast();

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };
  const { selectedChat, setSelectedChat, user, notification, setNotification } =
    ChatState();

  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      
      };
      // console.log(user);

      setLoading(true);

      const {data} = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );
      // console.log(selectedChat._id);
      setMessages(data);
      setLoading(false);

      socket.emit("join chat", selectedChat._id);
    } catch (error) {
      toast({
        title: "Error Occured!",
        description: "Failed to Load the Messages",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };
 
  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage) {
      socket.emit("stop typing", selectedChat._id);
     
      try {
        const config = {
          headers: {
            // "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        setNewMessage("");
       
        const { data } = await axios.post(
          "/api/message",
          {
            content: newMessage,
            chatId: selectedChat,
          },
          config
        );
        console.log("message recieved")
        socket.emit("new message", data);

        setMessages([...messages, data]);

        // If this chat includes the agent user, ask the agent and append its reply
        const hasAgent = Array.isArray(selectedChat?.users) && selectedChat.users.some((u) => u?.email === "agent@system");
        if (hasAgent) {
          try {
            const agentRes = await axios.post(
              "/api/agent/ask",
              {
                chatId: selectedChat._id || selectedChat, // support both id or object
                prompt: data.content,
              },
              config
            );
            const botMsg = agentRes.data;
            // Broadcast bot message via socket so other clients receive it
            socket.emit("new message", botMsg);
            setMessages((prev) => [...prev, botMsg]);
          } catch (agentErr) {
            console.error(agentErr);
            toast({
              title: "Agent Error",
              description: (agentErr.response && (agentErr.response.data?.message || agentErr.response.statusText)) || agentErr.message,
              status: "error",
              duration: 5000,
              isClosable: true,
              position: "bottom",
            });
          }
        }
      } catch (error) {
        
        console.log(error);
        toast({
          title: "Error Occured!",
          description: "Failed to send the Message",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
          
        });
      }
    }
  };

  // Ensure the AI agent exists and add it to the current chat (or create a group with it)
  const addAgentToChat = async () => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      // Ensure/get agent user
      const { data: agent } = await axios.get(`/api/agent/user`, config);

      if (selectedChat?.isGroupChat) {
        // Add agent to existing group chat
        const { data: updated } = await axios.put(
          "/api/chat/groupadd",
          { chatId: selectedChat._id, userId: agent._id },
          config
        );
        setSelectedChat(updated);
        toast({
          title: "Agent added to group",
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "bottom",
        });
      } else if (selectedChat) {
        // Create a new group with the other user + agent
        const otherUser = selectedChat.users.find((u) => u._id !== user._id);
        const usersArr = JSON.stringify([otherUser._id, agent._id]);
        const payload = { name: `${getSender(user, selectedChat.users)} + Agent`, users: usersArr };
        const { data: created } = await axios.post("/api/chat/group", payload, config);
        setSelectedChat(created);
        toast({
          title: "Group with agent created",
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "bottom",
        });
      }
    } catch (err) {
      toast({
        title: "Failed to add agent",
        description:
          (err.response && (err.response.data?.message || err.response.statusText)) || err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  useEffect(() => {
   
    socket = io(ENDPOINT);
    socket.emit("setup", user);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

   
  }, []);

  useEffect(() => {
    fetchMessages();

    selectedChatCompare = selectedChat;
   
  }, [selectedChat]);

  useEffect(() => {
    socket.on("message recieved", (newMessageRecieved) => {
      if (
        !selectedChatCompare || // if chat is not selected or doesn't match current chat
        selectedChatCompare._id !== newMessageRecieved.chat._id
      ) {
        if (!notification.includes(newMessageRecieved)) {
          setNotification([newMessageRecieved, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages([...messages, newMessageRecieved]);
      }
    });
  });

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }
    let lastTypingTime = new Date().getTime();
    var timerLength = 3000;
    setTimeout(() => {
      var timeNow = new Date().getTime();
      var timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  return (
    <>
      {selectedChat ? (
        <>
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={2}
            px={3}
            w="100%"
            fontFamily="Work sans"
            d="flex"
            justifyContent={{ base: "space-between" }}
            alignItems="center"
          >
            <IconButton
              d={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
            />
            {messages &&
              (!selectedChat.isGroupChat ? (
                <>
                  {getSender(user, selectedChat.users)}
                  <ProfileModal
                    user={getSenderFull(user, selectedChat.users)}
                  />
                  <Button size="sm" ml={3} onClick={addAgentToChat} colorScheme="blue">
                    Add Agent
                  </Button>
                </>
              ) : (
                <>
                  {selectedChat.chatName.toUpperCase()}
                  <UpdateGroupChatModal
                    fetchMessages={fetchMessages}
                    fetchAgain={fetchAgain}
                    setFetchAgain={setFetchAgain}
                  />
                  <Button size="sm" ml={3} onClick={addAgentToChat} colorScheme="blue">
                    Add Agent
                  </Button>
                </>
              ))}
          </Text>
          <Box
            d="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={4}
            bg="white"
            w="100%"
            h="100%"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="gray.200"
            boxShadow="md"
            overflowY="auto"
          >
            {loading ? (
              <Spinner
                size="xl"
                w={20}
                h={20}
                alignSelf="center"
                margin="auto"
              />
            ) : (
              <div className="messages">
                <ScrollableChat messages={messages} />
              </div>
            )}

            <FormControl
              onKeyDown={sendMessage}
              id="first-name"
              isRequired
              mt={3}
            >
              {istyping ? (
                <div>
                  <Lottie
                    options={defaultOptions}
                    // height={50}
                    width={70}
                    style={{ marginBottom: 15, marginLeft: 0 }}
                  />
                </div>
              ) : (
                <></>
              )}
              <Input
                variant="filled"
                placeholder="Enter a message.."
                value={newMessage}
                onChange={typingHandler}
              />
            </FormControl>
          </Box>
        </>
      ) : (
        // to get socket.io on same page
        <Box overflowY="scroll" d="flex" alignItems="center" justifyContent="center" h="100%">
          <Text fontSize="3xl" pb={3} fontFamily="Work sans">
            Click on a user to start chatting
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
