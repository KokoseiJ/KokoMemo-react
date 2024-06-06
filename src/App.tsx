import { useState, useEffect } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import axios, { AxiosResponse } from 'axios'
import bulmaCollapsible from '@creativebulma/bulma-collapsible';
import './kokomemo-bulma.scss'

interface Props {[key:string]: any}


interface User {
  id: string;
  name: string;
  email: string;
  used_bytes: number;
  created_at: Date;
  integrations: Array<{service: string;}>;
}


interface Wall {
  id: string;
  name: string;
  colour: number;
  created_at: Date;
  modified_at: Date;
}


interface Memo {
  id: string;
  user_id: string;
  wall_id: string;
  content: string;
  created_at: Date;
  modified_at: Date;
}


const API_HOST = "https://api.kokoseij.xyz/kokomemo/api/v1"

const client = axios.create({
  baseURL: API_HOST
});

let user: User | null;
let setUser: Function;

let currentTokenRefresh: Promise<object> | null = null;


function handleToken(at: string, rt: string) {
  console.log("handleToken", at, rt)
  localStorage.setItem("at", at);
  localStorage.setItem("rt", rt);
}


function wipeToken() {
  localStorage.removeItem("at");
  localStorage.removeItem("rt");
}


function getUserInfo() {
  return request("get", "/user/info").then(
    (resp: AxiosResponse) => resp.data.data
  )
}


function refresh(): Promise<object> {
  const rt = localStorage.getItem("rt");
  
  if (currentTokenRefresh !== null)
    return currentTokenRefresh;

  currentTokenRefresh = client.post(
    "/user/login/token/refresh", {token: rt}
  ).then(respData => {
    let data = respData.data.data
    handleToken(data.access_token, data.refresh_token)
    currentTokenRefresh = null;
    return data
  }, error => {
    console.error("refresh failed", error);
    alert("You have been logged out, plaese sign in again.")
    wipeToken();
    setUser(false);
    throw error;
  });

  return currentTokenRefresh;
}


function request(method: string, path: string, data: object | null = null): Promise<AxiosResponse> {
  let at = localStorage.getItem("at")
  return client.request({
    url: path,
    method: method,
    data: data,
    headers: {"Authorization": `Bearer ${at}`}
  }).then(
    respData => respData,
    error => {
      console.error("request failed", error)
      if (error.response && error.response.status == 401) {
        console.log("AT invalid, trying refresh");
        return refresh().then(
          ()=>{
            console.log("refresh successful, retrying request");
            return request(method, path, data);
          },
          (error) => {console.log("AGGA", error); throw error;}
        );
      }
      throw error;
    }
  );
}


function LoginModal({setModalState, handleLogin}:Props) {
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


function NavbarUserSection({user, setUser}:Props) {
  const [modalState, setModalState] = useState(false);

  function handleLogin(service: string, payload: object) {
    return client.post(`/user/login/${service}`, payload).then(authResp => {
      let data = authResp.data.data;
      handleToken(data.access_token, data.refresh_token);
      return getUserInfo().then(data => {
        setUser(data);
        setModalState(false);
        return data;
      }, error => {
        console.error("login failed", error)
      });
    });
  }

  function handleLogout() {
    return request("get", "/user/login/logout").then(() => {
      console.log("Bye.")
      wipeToken();
      setUser(null);
    })
  }

  if (!user)
    return (<>
      <div className="navbar-item">
        <button className="button" onClick={()=>setModalState(true)}>Log In</button>
      </div>
      {modalState ? <LoginModal setModalState={setModalState} handleLogin={handleLogin}/> : ""}
    </>);
  else return (<>
    <div className="navbar-item">
      <p>Hello, {user.name}!</p>
    </div>
    <div className="navbar-item">
      <button className="button" onClick={handleLogout}>Log Out</button>
    </div>
  </>);
}


function LoadLogInHome() {
  return (
    <section className="hero is-fullheight-with-navbar">
      <div className="hero-body">
        <div className="container has-text-centered">
          <p className="title">Loading...</p>
        </div>
      </div>
    </section>
  );
}



function NotLoggedInHome() {
  return (
    <section className="hero is-primary is-fullheight-with-navbar">
      <div className="hero-body">
        <div className="container has-text-centered">
          <p className="title">KokoMemo</p>
          <p className="subtitle">
            Like A Cubicle Wall, Next To Your Desk.
          </p>
        </div>
      </div>
    </section>
  );
}


function EditMemoModal({id, wallId, content, setContent, setIsDeleted, setModalState}: Props) {
  function handleSubmit(event: any) {
    const submitterElement = event.nativeEvent.submitter;
    const submitter = submitterElement !== null ? submitterElement.name : "error";
    const content = event.target.content.value

    event.preventDefault();
    
    if (submitter == "submit") {
      request("put", `/walls/${wallId}/memos`, {
        id: id,
        content: content
      }).then(() => {
        setContent(content);
        setModalState(false);
      });
    } else if (submitter == "delete") {
      request("delete", `/walls/${wallId}/memos/${id}`).then(() => {
        setIsDeleted(true);
        setModalState(false);
      });
    }
  }

  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={()=>setModalState(false)}></div>
      <div className="modal-content">
        <form className="box" onSubmit={handleSubmit}>
          <h1 className="title has-text-centered">Edit Memo</h1>
          <div className="field">
            <label className="label">Content</label>
            <textarea className="textarea" name="content"
                      defaultValue={content}
                      rows={15} style={{backgroundColor: "#feff9c", color: "#000000"}}> 
            </textarea>
          </div>
          <div className="field is-grouped is-flex is-justify-content-flex-end">
            <button name="delete" className="button is-danger">Delete</button>
            <button name="submit" className="button">Submit</button>
          </div>
        </form>
      </div>
    </div>
  )
}


function Memo({id, wallId, initialContent}: Props) {
  const [modalState, setModalState] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [content, setContent] = useState(initialContent);

  const hook = (meow: any) => {
    console.log("AGGA", meow);
    setModalState(meow);
  }

  if (isDeleted) return (<></>);

  return (<>
    <div className="block is-flex is-justify-content-center">
      <div className="box" style={{backgroundColor: "#feff9c"}} onClick={()=>setModalState(true)}>
        <p style={{color: "#000000", whiteSpace: "pre-wrap"}}>
          {content}
        </p>
      </div>
    </div>
    { modalState ?
      <EditMemoModal id={id}
                     wallId={wallId}
                     content={content}
                     setContent={setContent}
                     setIsDeleted={setIsDeleted}
                     setModalState={hook}/>
      : ""
    }
  </>)
}


function NewMemoModal({wallId, setMemos, setModalState}: Props) {
  function handleSubmit(event: any) {
    const content = event.target.content.value

    event.preventDefault();
    
    request("post", `/walls/${wallId}/memos`, {
      content: content
    }).then(resp => {
      const newMemo = resp.data.data;
      setMemos((memos: Array<Memo>) => [newMemo, ...memos]);
      setModalState(false);
    });
  }

  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={()=>setModalState(false)}></div>
      <div className="modal-content">
        <form className="box" onSubmit={handleSubmit}>
          <h1 className="title has-text-centered">New Memo</h1>
          <div className="field">
            <label className="label">Content</label>
            <textarea className="textarea" name="content"
                      defaultValue="Write a simple memo like this is a sticky note!"
                      rows={15} style={{backgroundColor: "#feff9c", color: "#000000"}}> 
            </textarea>
          </div>
          <div className="field is-grouped is-flex is-justify-content-flex-end">
            <button name="submit" className="button">Submit</button>
          </div>
        </form>
      </div>
    </div>
  )
}


function EditWallModal(
  {id, setModalState, name, setName, colour, setColour, setIsDeleted}: Props
) {
  function handleSubmit(event: any) {
    const name = event.target.name.value
    const colour = event.target.colour.value
    const colourNum = Number(colour.replace("#", "0x"))
    const submitter = event.nativeEvent.submitter.name;

    event.preventDefault();
    
    if (submitter == "submit") {
      request("put", "/walls/", {
        id: id,
        name: name,
        colour: colourNum
      }).then(() => {
        setName(name);
        setColour(colour);
        setModalState(false);
      });
    } else if (submitter == "delete") {
      request("delete", `/walls/${id}`).then(() => {
        setIsDeleted(true);
      });
    }
  }

  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={()=>setModalState(false)}></div>
      <div className="modal-content">
        <form className="box" onSubmit={handleSubmit}>
          <h1 className="title has-text-centered">Edit Wall</h1>
          <div className="field">
            <label className="label">Wall name</label>
            <input className="input" name="name" defaultValue={name} type="text" />
          </div>
          <div className="field">
            <label className="label">Wall colour</label>
            <input className="input" name="colour" type="color" defaultValue={colour} />
          </div>
          <div className="field is-grouped is-flex is-justify-content-flex-end">
            <button name="delete" className="button is-danger">Delete</button>
            <button name="submit" className="button">Submit</button>
          </div>
        </form>
      </div>
    </div>
  )
}


function Wall({id, initialName, initialColour}: Props) {
  const [memos, setMemos] = useState<Array<Memo> | null>(null);
  const [name, setName] = useState(initialName);
  const [colour, setColour] = useState(
    `#${initialColour.toString(16).padStart(6, '0')}`
  )
  const [instance, setInstance] = useState<any>(null);
  const [wallModalState, setWallModalState] = useState(false);
  const [memoModalState, setMemoModalState] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  useEffect(()=>{
    console.log("meow")
    if (instance === null) {
      const newInstance: any = bulmaCollapsible.attach(`#collapsible-${id}`)[0]
      setInstance(newInstance);
      newInstance.on('after:expand', () => {
        newInstance._originalHeight = newInstance.element.scrollHeight + 'px';
      })
      console.log(newInstance)
    } else if (memoModalState == false) {
      console.log("modal closed");
      instance._originalHeight = instance.element.scrollHeight + 'px';
      instance.element.style.height = instance.element.scrollHeight + 'px';
    }
  }, [memoModalState]);

  if (isDeleted) return (<></>);

  if (memos === null) {
    request("get", `/walls/${id}/memos`).then(resp => {
      setMemos(resp.data.data);
    });
  }

  return (
    <div className="box" style={{backgroundColor: colour}}>
      <a href={`#collapsible-${id}`} data-action="collapse" className="is-flex is-justify-content-space-between">
        <button className="button is-invisible">Edit</button>
        <h1 className="title">{name}</h1>
        <div>
          <button className="button is-primary" onClick={()=>setWallModalState(true)}>
            Edit
          </button>
        </div>
      </a>
      <div id={`collapsible-${id}`} className="is-collapsible">
        <div className="block is-flex is-justify-content-center">
          <button className="button is-primary" onClick={()=>setMemoModalState(true)}>New memo</button>
        </div>
        { memos !== null ?
          memos.map((memo: Memo) =>
            <Memo id={memo.id} wallId={id} initialContent={memo.content} key={memo.id}/>
          ) : "" 
        }
      </div>
      { wallModalState ?
        <EditWallModal setModalState={setWallModalState}
                       setName={setName} 
                       setColour={setColour}
                       setIsDeleted={setIsDeleted}
                       id={id}
                       name={name}
                       colour={colour}/>
        : ""
      }
      { memoModalState ?
        <NewMemoModal wallId={id}
                      setMemos={setMemos}
                      setModalState={setMemoModalState}/>
        : ""
      }
    </div>
  )
}


function NewWallModal({setModalState, setWalls}: Props) {
  function handleSubmit(event: any) {
    event.preventDefault()
    const name = event.target.name.value;
    const colour = Number(event.target.colour.value.replace("#", "0x"));

    request("post", "/walls", {"name": name, "colour": colour}).then(resp => {
      const newWall = resp.data.data;

      setWalls((walls: Array<Wall>)=>[newWall, ...walls]);
      setModalState(false);
    });
  }

  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={()=>setModalState(false)}></div>
      <div className="modal-content">
        <form className="box" onSubmit={handleSubmit}>
          <h1 className="title has-text-centered">New Wall</h1>
          <div className="field">
            <label className="label">Wall name</label>
            <input className="input" name="name" type="text" />
          </div>
          <div className="field">
            <label className="label">Wall colour</label>
            <input className="input" name="colour" type="color" defaultValue="#b5c9d4" />
          </div>
          <div className="field is-flex is-justify-content-flex-end">
            <button className="button">Submit</button>
          </div>
        </form>
      </div>
    </div>
  )
}


function MainHome() {
  const [walls, setWalls] = useState<Array<Wall> | null>(null);
  const [modalState, setModalState] = useState(false);

  if (walls === null) {
    request("get", "/walls").then(resp => {
      setWalls(resp.data.data);
    });
  }

  return (
    <section className="px-2 container">
      <div className="py-4 is-flex is-justify-content-space-between">
        <h1 className="title mb-0">Walls</h1>
        <div>
          <button className="button is-primary"
                  onClick={()=>{setModalState(true)}}>
            New Wall
          </button>
        </div>
      </div>
      { walls !== null ?
        walls.map((wall: Wall) =>
          <Wall id={wall.id}
                initialName={wall.name}
                initialColour={wall.colour}
                key={wall.id}/>
        ) : ""
      }
    { modalState ?
      <NewWallModal setModalState={setModalState} setWalls={setWalls}/>
      : "" 
    }
    </section>
  )
}


function App() {
  [user, setUser] = useState(null);
  console.log("rendering user", user);

  let at = localStorage.getItem("at");
  let rt = localStorage.getItem("rt");

  if (user === null) {
    if (at !== null && rt !== null) {
      console.log(user, at)
      handleToken(at, rt);
      getUserInfo().then(
        data => {
          setUser(data);
          console.log("meow");
        },
        error => {
          console.error("Stored session is invalid", error);
          wipeToken();
          setUser(false);
        }
      );
    } else {
      setUser(false);
    }
  }

  let home;

  if (user === null) home = (<LoadLogInHome/>);
  else if (user === false) home = (<NotLoggedInHome/>);
  else home = (<MainHome/>);

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
      { home }
    </>
  )
}

export default App;
