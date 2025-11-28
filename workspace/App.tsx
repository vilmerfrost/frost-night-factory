import React, { useState, useCallback } from 'react';
import DOMPurify from 'dompurify'; // Install with: npm install dompurify

interface LoginFormProps {
  onLoginSuccess: () => void;
  onLoginError?: (message: string) => void;
  isLoading?: boolean;
}

interface InputFieldProps {
  label: string;
  type: string;
  id: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
}

interface ErrorMessageProps {
  message: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  type,
  id,
  name,
  value,
  onChange,
  error,
  placeholder,
  disabled,
}) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${
            error ? 'border-red-500' : ''
          }`}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
};

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="rounded-md bg-red-50 p-4">
      <div className="flex">
        <div className="ml-3">
          <p className="text-sm font-medium text-red-800">{message}</p>
        </div>
      </div>
    </div>
  );
};

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onLoginError, isLoading }) => {
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsernameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const cleanUsername = DOMPurify.sanitize(event.target.value); // Sanitize
    setUsername(cleanUsername);
    setUsernameError(null);
    setGeneralError(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      let isValid = true;

      if (!username) {
        setUsernameError('Username is required.');
        isValid = false;
      }

      if (!isValid) {
        return;
      }

      setIsSubmitting(true);
      setGeneralError(null);

      // **REPLACE THIS WITH A REAL API CALL TO YOUR BACKEND**
      try {
        const response = await fetch('/api/login', { // Replace '/api/login' with your actual endpoint
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: username, password: (event.target.elements.namedItem('password') as HTMLInputElement).value }), // Send username and password
        });

        if (response.ok) {
          onLoginSuccess();
        } else {
          const errorData = await response.json(); // Assuming your API returns error info as JSON
          setGeneralError(errorData.message || 'Invalid credentials.');
          onLoginError && onLoginError(errorData.message || 'Invalid credentials.');
        }
      } catch (error) {
        console.error('Login error:', error);
        setGeneralError('An error occurred during login.');
        onLoginError && onLoginError('An error occurred during login.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [username, onLoginSuccess, onLoginError]
  );

  return (
    <div className="flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {generalError && <ErrorMessage message={generalError} />}
          <input type="hidden" name="remember" value="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <InputField
                label="Username"
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={handleUsernameChange}
                error={usernameError}
                placeholder="Username"
                disabled={isSubmitting || isLoading === true}
              />
            </div>
            <div className="mt-4">
              <InputField
                label="Password"
                type="password"
                id="password"
                name="password"
                value=""
                onChange={() => {}} // No need to update state here
                error={null}
                placeholder="Password"
                disabled={isSubmitting || isLoading === true}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isSubmitting || isLoading === true}
            >
              {isSubmitting || isLoading ? (
                'Logging in...'
              ) : (
                <>
                  Sign in
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;