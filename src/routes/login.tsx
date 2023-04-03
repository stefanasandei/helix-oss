import { FormError, useParams, useRouteData } from "solid-start";
import {
  createServerAction$,
  createServerData$,
  redirect,
} from "solid-start/server";
import { createUserSession, getUser } from "~/utils/session";
import { z } from "zod";
import { AuthError, login, register } from "~/utils/auth";
import { Show } from "solid-js";
import { User } from "@prisma/client";
import { getDB } from "~/utils/db";

export function routeData() {
  return createServerData$(async (_, { request }) => {
    if (await getUser(getDB()!, request)) {
      throw redirect("/");
    }
    return {};
  });
}

export default function LoginPage() {
  const data = useRouteData<typeof routeData>();
  const params = useParams();

  const [loggingIn, { Form }] = createServerAction$(async (form: FormData) => {
    const UserFormCredentials = z.object({
      username: z.string().min(3),
      email: z.string().email().nullable(),
      password: z.string().min(6),
    });

    const loginType = form.get("loginType");
    const username = form.get("username") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const redirectTo = (form.get("redirectTo") as string) || "/";

    if (!UserFormCredentials.safeParse({ username, email, password }))
      throw new FormError("Fields invalid");

    switch (loginType) {
      case "login": {
        const user = await login({ username, email, password });
        if ((user as AuthError).message) {
          throw new FormError((user as AuthError).message);
        }
        return createUserSession(`${(user as User).id}`, redirectTo);
      }
      case "register": {
        const userExists = await getDB()!.user.findUnique({
          where: { username },
        });
        if (userExists) {
          throw new FormError(`User with username ${username} already exists`);
        }
        const user = await register({ username, email, password });
        if ((user as AuthError).message) {
          throw new FormError((user as AuthError).message);
        }
        return createUserSession(`${(user as User).id}`, redirectTo);
      }
      default: {
        throw new FormError(`Login type invalid`);
      }
    }
  });

  return (
    <main>
      <Form>
        <input
          type="hidden"
          name="redirectTo"
          value={params.redirectTo ?? "/"}
        />
        <fieldset>
          <legend>Login or Register</legend>
          <label>
            <input type="radio" name="loginType" value="login" checked={true} />
            Login
          </label>
          <label>
            <input type="radio" name="loginType" value="register" /> Register
          </label>
          <div>
            <label for="username-input">*Username</label>
            <input name="username" required={true} />
          </div>
          <div>
            <label for="email-input">Email</label>
            <input name="email" type="email" />
          </div>
          <Show when={loggingIn.error?.fieldErrors?.username}>
            <p role="alert">{loggingIn.error.fieldErrors.username}</p>
          </Show>
          <div>
            <label for="password-input">*Password</label>
            <input name="password" type="password" required={true} />
          </div>
          <Show when={loggingIn.error?.fieldErrors?.password}>
            <p role="alert">{loggingIn.error.fieldErrors.password}</p>
          </Show>
          <Show when={loggingIn.error}>
            <p role="alert" id="error-message">
              {loggingIn.error.message}
            </p>
          </Show>
          <button type="submit">{"Login"}</button>
        </fieldset>
      </Form>
    </main>
  );
}
