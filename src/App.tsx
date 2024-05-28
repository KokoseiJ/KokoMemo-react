import { useState, createContext, useContext } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import './kokomemo-bulma.scss'

const API_HOST = "http://localhost:8000/api/v1"

const client = axios.create({
  baseURL: API_HOST
});


function handleToken(at, rt) {
  console.log(at, rt)
  localStorage.setItem("at", at);
  localStorage.setItem("rt", rt);
}


function wipeToken() {
  localStorage.removeItem("at");
  localStorage.removeItem("rt");
}


function refresh() {
  let rt = localStorage.getItem("rt");

  return client.post("/user/login/token/refresh", {token: rt}).then(
    respData => {
      let data = respData.data.data
      handleToken(data.access_token, data.refresh_token)
      return data
    }
  )
}


function request(method, path, data) {
  let at = localStorage.getItem("at")
  return client.request({
    url: path,
    method: method,
    data: data,
    headers: {"Authorization": `Bearer ${at}`}
  }).then(
    respData => respData,
    error => {
      if (error.response && error.response.status == 401) {
        console.log("AT invalid, trying refresh");
        return refresh().then(
          ()=>request(method, path, data),
          error => {
            console.error("refresh failed");
            throw error;
          }
        );
      }
      throw error;
    }
  );
}


function LoginModal({setModalState, handleLogin}) {
  return (
    <GoogleOAuthProvider clientId="147032281417-7ia4o5rajlj8or5rh8uu1j59ud805k62.apps.googleusercontent.com">
      <div className="modal is-active">
        <div className="modal-background" onClick={()=>setModalState(false)}>
        </div>
        <div className="modal-content">
          <div className="box py-6">
            <div className="columns py-6">
              <div className="column py-6">
                <h1 className="title has-text-centered">Log In</h1>
              </div>
              <div className="column py-6">
                <GoogleLogin
                  onSuccess={resp => handleLogin("google", {"token": resp.credential})}
                  onError={()=>{alert("Google Login failed");}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}


function NavbarUserSection({user, setUser}) {
  const [modalState, setModalState] = useState(false);

  function handleLogin(service, data) {
    return client.post(`/user/login/${service}`, data).then(
      authResp => {
        let data = authResp.data.data;
        handleToken(data.access_token, data.refresh_token);
        return request("get", "/user/info").then(resp => {
          let data = resp.data.data;
          setUser(data);
          setModalState(false);
          return data;
        });
      }
    );
  }

  function handleLogout() {
    return request("get", "/user/login/logout").finally(() => {
      wipeToken();
      setUser(null);
    })
  }

  if (user === null)
    return (<>
      <div className="navbar-item">
        <button className="button" onClick={()=>setModalState(true)}>Log In</button>
      </div>
      {modalState ? <LoginModal setModalState={setModalState} handleLogin={handleLogin}/> : ""}
    </>)
  else return (<>
    <div className="navbar-item">
      <p>Hello, {user.name}!</p>
    </div>
    <div className="navbar-item">
      <button className="button" onClick={handleLogout}>Log Out</button>
    </div>
  </>)
}


function App() {
  const [user, setUser] = useState(null);

  return (
    <>
      <nav className="navbar has-shadow">
        <div className="container">
          <div className="navbar-brand">
            <p className="navbar-item">KokoMemo</p>
          </div>
          <div className="navbar-menu is-active">
            <div className="navbar-end">
              <NavbarUserSection user={user} setUser={setUser}/>
            </div>
          </div>
        </div>
      </nav>
      { user === null ?
        <section className="hero is-primary is-fullheight-with-navbar">
          <div className="hero-body">
          </div>
        </section> :
        <section className="container hero is-fullheight-with-navbar">
          <h1 className="title">You've entered the secret society of the pigeon milkers</h1>
        </section>
      }
    </>
  )
}

export default App
