from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.models import User, UserRole
from app.schemas.schemas import UserLogin, Token, UserOut
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password, return JWT token with user role.
    """
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive"
        )
    
    user_role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token_payload = {
        "sub": user.id,
        "email": user.email,
        "role": user_role_val,
        "name": user.name
    }
    access_token = create_access_token(data=token_payload)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """
    Get current logged in user details.
    """
    return UserOut.model_validate(current_user)

@router.get("/work-teams", response_model=list[UserOut])
def list_work_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all active work_team users for assigning tasks.
    """
    work_teams = db.query(User).filter(User.role == UserRole.work_team, User.is_active == True).all()
    return [UserOut.model_validate(u) for u in work_teams]
