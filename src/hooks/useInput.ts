// Gamepad and Keyboard Input Hook
import { useEffect, useRef } from 'react';

export type InputAction = 'up' | 'down' | 'left' | 'right' | 'action' | 'back';

interface UseInputOptions {
  onInput: (action: InputAction) => void;
  isActive?: boolean;
}

export function useInput({ onInput, isActive = true }: UseInputOptions) {
  const requestRef = useRef<number>(0);
  const lastState = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!isActive) return;

    // Keyboard support
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          onInput('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          onInput('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          onInput('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          onInput('right');
          break;
        case 'Enter':
        case ' ':
          onInput('action');
          break;
        case 'Escape':
        case 'Backspace':
          onInput('back');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Gamepad support (polling)
    const checkGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads.find(g => g !== null); // Use first connected gamepad

      if (gp) {
        const checkButton = (buttonIndex: number, action: InputAction) => {
          const isPressed = gp.buttons[buttonIndex]?.pressed;
          const wasPressed = lastState.current[`btn_${buttonIndex}`];
          
          if (isPressed && !wasPressed) {
            onInput(action);
          }
          lastState.current[`btn_${buttonIndex}`] = isPressed;
        };

        // Standard mapping
        checkButton(12, 'up');      // D-Pad Up
        checkButton(13, 'down');    // D-Pad Down
        checkButton(14, 'left');    // D-Pad Left
        checkButton(15, 'right');   // D-Pad Right
        checkButton(0, 'action');   // Cross / A
        checkButton(1, 'back');     // Circle / B

        // Analog stick (Left) with deadzone
        const xAxis = gp.axes[0];
        const yAxis = gp.axes[1];
        const deadzone = 0.5;

        const leftPressed = xAxis < -deadzone;
        const rightPressed = xAxis > deadzone;
        const upPressed = yAxis < -deadzone;
        const downPressed = yAxis > deadzone;

        if (leftPressed && !lastState.current.stick_left) onInput('left');
        if (rightPressed && !lastState.current.stick_right) onInput('right');
        if (upPressed && !lastState.current.stick_up) onInput('up');
        if (downPressed && !lastState.current.stick_down) onInput('down');

        lastState.current.stick_left = leftPressed;
        lastState.current.stick_right = rightPressed;
        lastState.current.stick_up = upPressed;
        lastState.current.stick_down = downPressed;
      }

      requestRef.current = requestAnimationFrame(checkGamepad);
    };

    requestRef.current = requestAnimationFrame(checkGamepad);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(requestRef.current);
    };
  }, [onInput, isActive]);
}
